import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Game() {
  const { code } = useParams()
  const navigate = useNavigate()
  const isHost = localStorage.getItem('isHost') === 'true' && localStorage.getItem('roomCode')?.toLowerCase() === code.toLowerCase()
  
  const [room, setRoom] = useState(null)
  const [players, setPlayers] = useState([])
  const [votes, setVotes] = useState([])
  const [resultsVotes, setResultsVotes] = useState([])
  const [hasVoted, setHasVoted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(15)
  const [showResults, setShowResults] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [roundNumber, setRoundNumber] = useState(1)
  const [winner, setWinner] = useState(null)
  const [winners, setWinners] = useState([])
  const [isEndingVoting, setIsEndingVoting] = useState(false)
  const [showDetailedVotes, setShowDetailedVotes] = useState(false)
  const processedRoundRef = useRef(null)
  
  const myNickname = localStorage.getItem('nickname')

  useEffect(() => {
    // Verify user has required localStorage data
    const storedRoomCode = localStorage.getItem('roomCode')
    const nickname = localStorage.getItem('nickname')
    
    if (storedRoomCode?.toLowerCase() !== code.toLowerCase() || !nickname) {
      navigate('/')
      return
    }

    const validateAndLoad = async () => {
      // Verify room still exists
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code.toLowerCase())
        .single()

      if (roomError || !room) {
        localStorage.removeItem('nickname')
        localStorage.removeItem('roomCode')
        localStorage.removeItem('isHost')
        navigate('/')
        return
      }

      // If room status is 'waiting', redirect to lobby
      if (room.status === 'waiting') {
        window.location.href = isHost ? `/host/${code}` : `/lobby/${code}`
        return
      }

      const handleEndGame = async () => {
        await supabase
          .from('rooms')
          .update({ status: 'ended' })
          .eq('code', code.toLowerCase())
        
        navigate('/game-over')
      }

      // Verify player is still in the players table
      const { data: playerData } = await supabase
        .from('players')
        .select('nickname')
        .eq('room_code', code.toLowerCase())
        .eq('nickname', nickname)
        .single()

      if (!playerData) {
        localStorage.removeItem('nickname')
        localStorage.removeItem('roomCode')
        localStorage.removeItem('isHost')
        navigate('/')
        return
      }

      // Fetch initial room data
      fetchRoom()
      fetchPlayers()
      fetchVotes()
    }

    validateAndLoad()

    // Subscribe to room changes
    const roomChannel = supabase
      .channel(`room:${code.toLowerCase()}:game`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `code=eq.${code.toLowerCase()}`
        },
        (payload) => {
          console.log("=== ROOM SUBSCRIPTION TRIGGERED ===", payload)
          setRoom(payload.new)
          // Sync round number from database
          if (payload.new.round_number !== undefined) {
            setRoundNumber(payload.new.round_number)
          }
          // Sync show_summary state - check if it changed
          if (payload.new.show_summary !== payload.old.show_summary) {
            setShowSummary(payload.new.show_summary || false)
            if (payload.new.show_summary) {
              setShowResults(false)
              fetchPlayers() // Refresh players data to get latest drink counts
            }
          }
          // Sync show_detailed_votes state
          if (payload.new.show_detailed_votes !== payload.old.show_detailed_votes) {
            setShowDetailedVotes(payload.new.show_detailed_votes || false)
          }
          // If room status changes to 'waiting', redirect to lobby
          if (payload.new.status === 'waiting') {
            window.location.href = isHost ? `/host/${code}` : `/lobby/${code}`
          }
          // If room status changes to 'ended', redirect to game over screen
          if (payload.new.status === 'ended') {
            navigate('/game-over')
          }
          // Only reset voting state if current_question changes AND round_number increases
          // This prevents resetting showResults when other room fields are updated
          const questionChanged = payload.old.current_question !== payload.new.current_question
          const roundIncreased = payload.new.round_number > (payload.old.round_number || 0)
          console.log("=== ROOM UPDATE CHECK ===", { questionChanged, roundIncreased, oldQuestion: payload.old.current_question, newQuestion: payload.new.current_question, oldRound: payload.old.round_number, newRound: payload.new.round_number })
          if (questionChanged && roundIncreased) {
            console.log("=== RESETTING VOTING STATE FOR NEW ROUND ===")
            setShowResults(false)
            setHasVoted(false)
            setTimeLeft(15)
            setVotes([])
            setResultsVotes([])
            setWinner(null)
            setWinners([])
            setIsEndingVoting(false)
          }
        }
      )
      .subscribe()

    // Subscribe to votes changes (critical for voting sync)
    const votesChannel = supabase
      .channel(`votes:${code.toLowerCase()}:game`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
          filter: `room_code=eq.${code.toLowerCase()}`
        },
        (payload) => {
          console.log("=== VOTES SUBSCRIPTION TRIGGERED ===", payload)
          fetchVotes()
        }
      )
      .subscribe()

    // Subscribe to players changes to sync drink_count updates
    const playersChannel = supabase
      .channel(`players:${code.toLowerCase()}:game`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `room_code=eq.${code.toLowerCase()}`
        },
        (payload) => {
          console.log("=== PLAYERS SUBSCRIPTION TRIGGERED ===", payload)
          fetchPlayers()
        }
      )
      .subscribe()

    // Poll players every 3 seconds as backup
    const playersInterval = setInterval(() => {
      fetchPlayers()
    }, 3000)

    // Poll room status every 2 seconds to check for game end (fallback for subscription issues)
    const roomStatusInterval = setInterval(async () => {
      const { data: roomData } = await supabase
        .from('rooms')
        .select('status')
        .eq('code', code.toLowerCase())
        .single()
      
      if (roomData?.status === 'ended') {
        navigate('/game-over')
      }
    }, 2000)

    return () => {
      supabase.removeChannel(roomChannel)
      supabase.removeChannel(votesChannel)
      supabase.removeChannel(playersChannel)
      clearInterval(playersInterval)
      clearInterval(roomStatusInterval)
    }
  }, [code, isHost, navigate])

  useEffect(() => {
    if (room && room.status === 'playing' && !showResults && room.round_end_time) {
      // Calculate remaining time from database timestamp
      const timer = setInterval(() => {
        const now = new Date().getTime()
        const endTime = new Date(room.round_end_time).getTime()
        const remaining = Math.max(0, Math.ceil((endTime - now) / 1000))
        
        setTimeLeft(remaining)
        
        if (remaining <= 0) {
          clearInterval(timer)
          // Only end voting if not all players have voted (auto-advance handles that case)
          const uniqueVoters = new Set(votes.map(v => v.voter_nickname))
          if (uniqueVoters.size < players.length) {
            console.log("⏰ Timer ended but not all players voted. Ending voting.")
            endVoting(roundNumber)
          } else {
            console.log("⏰ Timer ended but all players already voted. Auto-advance handled it.")
          }
        }
      }, 100)

      return () => clearInterval(timer)
    }
  }, [room, showResults, votes, players])

  useEffect(() => {
    // Fetch fresh votes when results are shown (for non-host players)
    if (showResults) {
      const fetchResultsVotes = async () => {
        console.log("=== FETCHING RESULTS VOTES FOR DISPLAY ===");
        const { data: freshVotes } = await supabase
          .from('votes')
          .select('*')
          .eq('room_code', code.toLowerCase())
          .eq('round_number', roundNumber)
        
        console.log("Results votes from DB:", freshVotes);
        if (freshVotes) {
          setResultsVotes(freshVotes)
        }
      }
      fetchResultsVotes()
    }
  }, [showResults, roundNumber, code])

  useEffect(() => {
    // Check if all players have voted
    console.log("=== VOTE COMPLETION CHECK ===");
    console.log("Total players in room:", players.length);
    console.log("Votes received this round:", votes.length);
    console.log("Round number:", roundNumber);
    console.log("Show results:", showResults);
    console.log("Is ending voting:", isEndingVoting);
    console.log("Condition check:", players.length > 0 && votes.length >= players.length && !showResults && !isEndingVoting);
    
    // Count unique voters to prevent duplicate votes from triggering early
    const uniqueVoters = new Set(votes.map(v => v.voter_nickname))
    console.log("Unique voters count:", uniqueVoters.size);
    console.log("Unique voters:", Array.from(uniqueVoters));
    console.log("Player nicknames:", players.map(p => p.nickname));
    
    if (players.length > 0 && uniqueVoters.size >= players.length && !showResults && !isEndingVoting) {
      console.log("✅ All players have voted! Ending voting period.");
      setIsEndingVoting(true)
      endVoting(roundNumber)
    } else {
      console.log("❌ Not all players have voted yet. Waiting for more votes.");
    }
  }, [votes, players, showResults, roundNumber, isEndingVoting])

  const fetchRoom = async () => {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code.toLowerCase())
      .single()
    
    if (data) {
      setRoom(data)
      setShowDetailedVotes(data.show_detailed_votes || false)
      // Calculate round number from existing votes
      const { data: existingVotes } = await supabase
        .from('votes')
        .select('round_number')
        .eq('room_code', code.toLowerCase())
      
      if (existingVotes && existingVotes.length > 0) {
        const maxRound = Math.max(...existingVotes.map(v => v.round_number))
        setRoundNumber(maxRound + 1)
      }
    }
  }

  const fetchPlayers = async () => {
    const { data, error } = await supabase
      .from('players')
      .select('nickname, drink_count, emoji')
      .eq('room_code', code.toLowerCase())
    
    console.log("=== FETCH PLAYERS ===", { data, error })
    if (data) {
      console.log("Players data with drink counts:", data.map(p => ({ nickname: p.nickname, drink_count: p.drink_count })))
      setPlayers(data)
    }
  }

  const fetchVotes = async () => {
    console.log("=== FETCH VOTES CALLED ===");
    console.log("Room code:", code.toLowerCase());
    console.log("Current roundNumber state:", roundNumber);
    
    // Fetch ALL votes for this room to determine the actual current round
    const { data: allVotes } = await supabase
      .from('votes')
      .select('round_number')
      .eq('room_code', code.toLowerCase())
    
    let actualRound = roundNumber
    if (allVotes && allVotes.length > 0) {
      const maxRound = Math.max(...allVotes.map(v => v.round_number))
      actualRound = maxRound
      console.log("Detected actual round from votes:", actualRound);
    }
    
    const { data } = await supabase
      .from('votes')
      .select('*')
      .eq('room_code', code.toLowerCase())
      .eq('round_number', actualRound)
    
    console.log("Fetching votes for round:", actualRound);
    console.log("Votes fetched:", data);
    console.log("Votes count:", data?.length);
    
    if (data) {
      setVotes(data)
      // Update roundNumber if we detected a newer round
      if (actualRound > roundNumber) {
        setRoundNumber(actualRound)
      }
      // Check if current player has voted in database
      const myVote = data.find(v => v.voter_nickname === myNickname)
      // Only set hasVoted to true if we find their vote, never reset to false
      // This prevents real-time updates from unlocking the button after user has voted
      if (myVote && !hasVoted) {
        setHasVoted(true)
      }

      // Check if all players have voted and trigger results if so
      const { data: allPlayers } = await supabase
        .from('players')
        .select('nickname')
        .eq('room_code', code.toLowerCase())
      
      if (allPlayers) {
        const uniqueVoters = new Set(data.map(v => v.voter_nickname))
        if (uniqueVoters.size >= allPlayers.length && !showResults && !isEndingVoting) {
          console.log("✅ All players have voted in fetchVotes! Ending voting period.")
          setIsEndingVoting(true)
          endVoting(actualRound)
        }
      }
    }
  }

  const handleVote = async (votedFor) => {
    if (hasVoted) return
    
    // Prevent self-voting
    if (votedFor === myNickname) {
      console.error('Cannot vote for yourself')
      return
    }

    // Force local button lockout immediately
    setHasVoted(true)

    // Force dump variables to console
    console.log("=== VOTING DEBUG PROFILE ===");
    console.log("Current Room Code Variable:", code);
    console.log("Current Round Number Variable:", roundNumber);
    console.log("My Nickname (Voter):", myNickname);
    console.log("Is Host:", isHost);
    console.log("Target Player Voted For:", votedFor);

    // Fetch current round number from database
    const { data: roomData } = await supabase
      .from('rooms')
      .select('round_number')
      .eq('code', code.toLowerCase())
      .single()

    const currentRound = roomData?.round_number || roundNumber

    const voteData = {
      room_code: code.toLowerCase(),
      round_number: currentRound,
      voter_nickname: myNickname,
      voted_for: votedFor
    }
    
    console.log("Vote data to insert:", voteData);
    console.log("Round from database:", currentRound);

    console.log("Attempting to insert vote:", voteData);
    const { data, error } = await supabase
      .from('votes')
      .insert(voteData)
      .select()
    
    console.log("Insert result data:", data);
    console.log("Insert result error:", error);
    
    if (error) {
      console.error("Vote insertion error:", error)
      setHasVoted(false) // Re-enable button if error occurs
      return
    }
    
    if (!data || data.length === 0) {
      console.error("Vote insertion returned no data")
      setHasVoted(false)
      return
    }
  }

  const endVoting = async (actualRoundNumber) => {
    console.log("=== END VOTING - CALCULATING RESULTS ===");
    
    // Use the actual round number from votes if provided (to handle stale closures)
    const roundToProcess = actualRoundNumber || roundNumber;
    
    // Prevent duplicate processing of the same round using ref (synchronous)
    if (processedRoundRef.current === roundToProcess) {
      console.log("=== ROUND ALREADY PROCESSED ===", { processedRound: processedRoundRef.current, roundToProcess, roundNumber })
      return
    }
    processedRoundRef.current = roundToProcess
    console.log("=== PROCESSING NEW ROUND ===", roundToProcess)
    
    // Fetch fresh votes from database for current round
    const { data: freshVotes } = await supabase
      .from('votes')
      .select('*')
      .eq('room_code', code.toLowerCase())
      .eq('round_number', roundToProcess)
    
    console.log("Fresh votes from DB:", freshVotes);
    console.log("Fresh votes count:", freshVotes?.length);
    console.log("Players in room:", players);
    
    // Update local votes state with fresh data
    if (freshVotes) {
      setVotes(freshVotes)
      setResultsVotes(freshVotes)
    }
    
    setShowResults(true)
    
    // Calculate winner(s) using fresh votes
    const voteCounts = {}
    freshVotes?.forEach(vote => {
      voteCounts[vote.voted_for] = (voteCounts[vote.voted_for] || 0) + 1
    })
    
    console.log("Vote counts:", voteCounts);
    
    let maxVotes = 0
    for (const [nickname, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count
      }
    }
    
    // Find all players with max votes (handle ties)
    const roundWinners = Object.entries(voteCounts)
      .filter(([nickname, count]) => count === maxVotes && count > 0)
      .map(([nickname]) => nickname)
    
    console.log("Winner(s):", roundWinners, "with", maxVotes, "votes each");
    
    setWinner(roundWinners.length === 1 ? roundWinners[0] : null)
    setWinners(roundWinners)
    
    console.log("=== ABOUT TO UPDATE DRINK COUNTS ===", { roundWinners, freshVotes })
    
    // Update all winners' drink count by the number of votes they received
    console.log("=== CHECKING IF ROUND WINNERS EXIST ===", roundWinners.length > 0)
    if (roundWinners.length > 0) {
      console.log("=== ROUND WINNERS FOUND, UPDATING DRINK COUNTS ===")
      // Get vote counts for this round using freshVotes
      const voteCounts = {}
      freshVotes.forEach(vote => {
        voteCounts[vote.voted_for] = (voteCounts[vote.voted_for] || 0) + 1
      })
      console.log("=== VOTE COUNTS FOR DRINK UPDATE ===", voteCounts)

      for (const winnerNickname of roundWinners) {
        console.log("=== PROCESSING WINNER ===", winnerNickname)
        // Only host updates drink counts to prevent race conditions
        if (!isHost) {
          console.log("=== SKIPPING DRINK UPDATE - NOT HOST ===")
          continue
        }
        
        const votesReceived = voteCounts[winnerNickname] || 0
        console.log("=== DRINK COUNT INCREMENT ===", { 
          winnerNickname, 
          votesReceived,
          roundNumber
        })
        
        // Get current drink count and update
        const { data: playerData } = await supabase
          .from('players')
          .select('drink_count')
          .eq('room_code', code.toLowerCase())
          .eq('nickname', winnerNickname)
          .single()
        
        if (playerData) {
          const newDrinkCount = (playerData.drink_count || 0) + votesReceived
          console.log("=== DRINK COUNT UPDATE ===", { 
            winnerNickname, 
            currentCount: playerData.drink_count, 
            votesReceived, 
            newCount: newDrinkCount,
            roundNumber
          })
          
          const { error: updateError } = await supabase
            .from('players')
            .update({ drink_count: newDrinkCount })
            .eq('room_code', code.toLowerCase())
            .eq('nickname', winnerNickname)
          
          console.log("=== DRINK COUNT UPDATE RESULT ===", { error: updateError })
        }
      }
    }
  }

  const handleNextRound = async () => {
    const { questions } = await import('../data/questions')
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)]
    
    const newRoundNumber = roundNumber + 1
    const roundEndTime = new Date(Date.now() + 15 * 1000).toISOString()
    
    await supabase
      .from('rooms')
      .update({
        current_question: randomQuestion,
        round_number: newRoundNumber,
        round_end_time: roundEndTime
      })
      .eq('code', code.toLowerCase())
    
    // Reset state for new round
    processedRoundRef.current = null
    setShowResults(false)
    setShowSummary(false)
    setHasVoted(false)
    setVotes([])
    setResultsVotes([])
    setWinner(null)
    setWinners([])
    setRoundNumber(newRoundNumber)
    setIsEndingVoting(false)
  }

  const handleShowSummary = async () => {
    await supabase
      .from('rooms')
      .update({ show_summary: true })
      .eq('code', code.toLowerCase())
  }

  const handleContinueFromSummary = async () => {
    const { questions } = await import('../data/questions')
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)]
    const newRoundNumber = roundNumber + 1
    const roundEndTime = new Date(Date.now() + 15 * 1000).toISOString()
    
    await supabase
      .from('rooms')
      .update({
        current_question: randomQuestion,
        round_number: newRoundNumber,
        round_end_time: roundEndTime,
        show_summary: false
      })
      .eq('code', code.toLowerCase())
    
    // Reset state for new round
    processedRoundRef.current = null
    setShowResults(false)
    setShowSummary(false)
    setHasVoted(false)
    setVotes([])
    setResultsVotes([])
    setWinner(null)
    setWinners([])
    setRoundNumber(newRoundNumber)
    setIsEndingVoting(false)
  }

  const handleEndGame = async () => {
    await supabase
      .from('rooms')
      .update({ status: 'ended' })
      .eq('code', code.toLowerCase())
    
    navigate('/game-over')
  }

  const handleRemovePlayer = async (playerNickname) => {
    // Don't delete the player from database to preserve their votes
    // Instead, mark them as removed in the room metadata
    const { data: room } = await supabase
      .from('rooms')
      .select('removed_players')
      .eq('code', code.toLowerCase())
      .single()
    
    const removedPlayers = room?.removed_players || []
    if (!removedPlayers.includes(playerNickname)) {
      removedPlayers.push(playerNickname)
      
      await supabase
        .from('rooms')
        .update({ removed_players: removedPlayers })
        .eq('code', code.toLowerCase())
    }
    
    // Check if active player count dropped below 2
    const { data: allPlayers } = await supabase
      .from('players')
      .select('nickname')
      .eq('room_code', code.toLowerCase())
    
    const activePlayers = allPlayers.filter(p => !removedPlayers.includes(p.nickname))
    
    if (activePlayers.length < 2) {
      await supabase
        .from('rooms')
        .update({ status: 'ended' })
        .eq('code', code.toLowerCase())
      
      navigate('/game-over')
    }
  }

  if (!room || room.status === 'waiting') {
    return <div className="game">Loading...</div>
  }

  if (showSummary) {
    const removedPlayers = room?.removed_players || []
    const activePlayers = players.filter(p => !removedPlayers.includes(p.nickname))
    const sortedPlayers = [...activePlayers].sort((a, b) => (b.drink_count || 0) - (a.drink_count || 0))
    
    console.log("=== SUMMARY SCREEN ===", { 
      players, 
      removedPlayers, 
      activePlayers, 
      sortedPlayers 
    })

    return (
      <div className="game results">
        <h2 className="results-title">Round {roundNumber} Summary</h2>
        <p style={{ marginBottom: '2rem', color: '#a0a0a0' }}>Total drinks after {roundNumber} rounds</p>
        
        <div className="vote-chart">
          {sortedPlayers.map(player => (
            <div key={player.nickname} className="vote-bar">
              <div className="vote-bar-label">
                <span>
                  {player.emoji && <span style={{ marginRight: '0.5rem' }}>{player.emoji}</span>}
                  {player.nickname}
                </span>
                <span>{player.drink_count || 0} drinks</span>
              </div>
              <div 
                className="vote-bar-fill" 
                style={{ width: `${sortedPlayers.length > 0 ? ((player.drink_count || 0) / sortedPlayers[0].drink_count) * 100 : 0}%` }}
              />
            </div>
          ))}
        </div>
        
        {isHost && (
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
            <button className="btn btn-primary btn-large" onClick={handleContinueFromSummary}>
              Next Round
            </button>
            <button 
              className="btn btn-secondary btn-large" 
              onClick={handleEndGame}
              style={{ backgroundColor: '#ff4444' }}
            >
              End Game
            </button>
          </div>
        )}

        {!isHost && (
          <div style={{ marginTop: '2rem', color: '#a0a0a0', fontSize: '0.9rem' }}>
            Waiting for host to start next round...
          </div>
        )}
      </div>
    )
  }

  if (showResults) {
    const removedPlayers = room?.removed_players || []
    const activePlayers = players.filter(p => !removedPlayers.includes(p.nickname))
    
    const voteCounts = {}
    resultsVotes.forEach(vote => {
      voteCounts[vote.voted_for] = (voteCounts[vote.voted_for] || 0) + 1
    })
    
    const maxVotes = Math.max(...Object.values(voteCounts), 0)

    return (
      <div className="game results">
        <h2 className="results-title">Results</h2>
        
        <div className="vote-chart">
          {players.map(player => {
            const count = voteCounts[player.nickname] || 0
            const percentage = activePlayers.length > 0 ? (count / activePlayers.length) * 100 : 0
            const isWinner = winners.includes(player.nickname)
            const isRemoved = removedPlayers.includes(player.nickname)
            
            return (
              <div key={player.nickname} className={`vote-bar ${isWinner ? 'winner' : ''} ${isRemoved ? 'removed' : ''}`}>
                <div className="vote-bar-label">
                  <span>
                    {player.emoji && <span style={{ marginRight: '0.5rem' }}>{player.emoji}</span>}
                    {player.nickname}{isRemoved ? ' (removed)' : ''}
                  </span>
                  <span>{count} votes</span>
                </div>
                <div 
                  className="vote-bar-fill" 
                  style={{ width: `${percentage}%` }}
                />
              </div>
            )
          })}
        </div>
        
        {winners.length > 0 && (
          <div className="winner-message">
            {winners.length === 1 ? (
              <h3>{winners[0]} drinks! 🍺</h3>
            ) : (
              <h3>{winners.join(' & ')} drink! 🍺</h3>
            )}
          </div>
        )}
        
        {isHost && (
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-large" onClick={handleNextRound}>
              Next Round
            </button>
            <button 
              className="btn btn-secondary btn-large" 
              onClick={handleShowSummary}
              style={{ backgroundColor: '#667eea' }}
            >
              Drinks So Far
            </button>
            <button 
              className="btn btn-secondary btn-large" 
              onClick={async () => {
                const newState = !showDetailedVotes
                setShowDetailedVotes(newState)
                await supabase
                  .from('rooms')
                  .update({ show_detailed_votes: newState })
                  .eq('code', code.toLowerCase())
              }}
              style={{ backgroundColor: '#ff6b6b' }}
            >
              {showDetailedVotes ? 'Hide Votes' : 'Reveal Votes'}
            </button>
            <button 
              className="btn btn-secondary btn-large" 
              onClick={handleEndGame}
              style={{ backgroundColor: '#ff4444' }}
            >
              End Game
            </button>
          </div>
        )}
        
        {showDetailedVotes && (
          <div className="detailed-votes" style={{ marginTop: '2rem', background: '#1f1f1f', padding: '1.5rem', borderRadius: '12px', border: '2px solid #333' }}>
            <h3 style={{ marginBottom: '1rem', color: '#ff6b6b' }}>Who voted for who:</h3>
            {resultsVotes.map(vote => (
              <div key={vote.id} style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>
                <span style={{ color: '#a0a0a0' }}>{vote.voter_nickname}</span>
                <span style={{ margin: '0 0.5rem', color: '#666' }}>→</span>
                <span style={{ color: '#ffffff', fontWeight: 600 }}>{vote.voted_for}</span>
              </div>
            ))}
          </div>
        )}

        {isHost && (
          <div className="players-section" style={{ marginTop: '2rem' }}>
            <h3>Players ({activePlayers.length})</h3>
            <ul className="players-list">
              {activePlayers.map((player, index) => (
                <li key={index} className="player-item">
                  <span>
                    {player.emoji && <span style={{ marginRight: '0.5rem' }}>{player.emoji}</span>}
                    {player.nickname}
                  </span>
                  <button 
                    className="remove-player-btn"
                    onClick={() => handleRemovePlayer(player.nickname)}
                    title="Remove player"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  const votingPlayers = players

  return (
    <div className="game">
      <div className="timer">Time left: {timeLeft}s</div>
      
      {/* Live vote counter */}
      <div className="vote-counter">
        {new Set(votes.map(v => v.voter_nickname)).size} / {players.length} votes cast
      </div>
      
      {/* Debug info */}
      <div style={{ fontSize: '10px', color: '#666', marginBottom: '10px' }}>
        Players: {players.length} | Votes: {votes.length} | Round: {roundNumber}
      </div>
      
      <div className="question-card">
        <h2 className="question-text">{room.current_question}</h2>
      </div>
      
      <div className="players-section">
        <h3>Vote for:</h3>
        <div className="vote-buttons" style={hasVoted ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
          {votingPlayers.map(player => {
            const isSelf = player.nickname === myNickname
            return (
              <button
                key={player.nickname}
                className={`btn vote-btn ${hasVoted ? 'disabled' : ''} ${isSelf ? 'self-vote' : ''}`}
                onClick={() => handleVote(player.nickname)}
                disabled={hasVoted || isSelf}
                style={isSelf ? { opacity: 0.5 } : {}}
              >
                {player.nickname} {isSelf && '(You)'}
              </button>
            )
          })}
        </div>
      </div>
      
      {hasVoted && <p className="voted-message">Vote submitted! Waiting for other players...</p>}
    </div>
  )
}

export default Game

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Game() {
  const { code } = useParams()
  const navigate = useNavigate()
  const myNickname = localStorage.getItem('nickname')
  const [isHost, setIsHost] = useState(false)
  
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
          // Always sync round number from database (not just when defined)
          if (payload.new.round_number !== undefined && payload.new.round_number !== null) {
            console.log("=== SYNCING ROUND NUMBER ===", { old: roundNumber, new: payload.new.round_number })
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
            setShowDetailedVotes(false) // Reset reveal votes for new round
            processedRoundRef.current = null // Reset processed round for new round
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

    // Separate channel for reveal votes sync (broadcast, not database)
    const revealVotesChannel = supabase
      .channel(`reveal_votes:${code.toLowerCase()}`)
      .on('broadcast', { event: 'reveal_votes' }, (payload) => {
        console.log("=== REVEAL VOTES BROADCAST ===", payload)
        setShowDetailedVotes(true)
      })
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
      supabase.removeChannel(revealVotesChannel)
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
      // Check if current user is the host based on database
      setIsHost(data.host === myNickname)
      
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
    
    // Show results directly
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
    return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-5">Loading...</div>
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-5">
        <div className="container mx-auto px-4 max-w-2xl text-center">
          <h2 className="text-4xl font-bold mb-2 text-white tracking-tight">Round {roundNumber} Summary</h2>
          <p className="mb-8 text-slate-300">Total drinks after {roundNumber} rounds</p>
          
          <div className="w-full space-y-4">
            {sortedPlayers.map(player => (
              <div key={player.nickname} className="w-full">
                <div className="flex justify-between items-center mb-2">
                  <span className="flex items-center font-medium text-slate-200">
                    {player.emoji && <span className="mr-2 text-2xl">{player.emoji}</span>}
                    {player.nickname}
                  </span>
                  <span className="font-semibold text-white">{player.drink_count || 0} drinks</span>
                </div>
                <div 
                  className="h-2 bg-zinc-800 rounded-full overflow-hidden"
                  style={{ width: `${sortedPlayers.length > 0 ? ((player.drink_count || 0) / sortedPlayers[0].drink_count) * 100 : 0}%` }}
                >
                  <div className="h-full bg-indigo-500 transition-all duration-300 ease-in-out" style={{ width: '100%' }} />
                </div>
              </div>
            ))}
          </div>
          
          {isHost && (
            <div className="flex gap-4 justify-center mt-8 flex-wrap">
              <button className="text-lg font-semibold py-4 px-8 rounded-xl border-none cursor-pointer transition-all duration-300 ease-in-out hover:bg-indigo-600 active:scale-95 min-w-[200px] bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" onClick={handleContinueFromSummary}>
                Next Round
              </button>
              <button 
                className="text-lg font-semibold py-4 px-8 rounded-xl border-none cursor-pointer transition-all duration-300 ease-in-out hover:bg-red-500 active:scale-95 min-w-[200px] bg-red-600 text-white shadow-lg shadow-red-600/20"
                onClick={handleEndGame}
              >
                End Game
              </button>
            </div>
          )}

          {!isHost && (
            <div className="mt-8 text-slate-400 text-sm font-medium">
              Waiting for host to start next round...
            </div>
          )}
        </div>
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

    const sortedPlayers = [...players].sort((a, b) => (voteCounts[b.nickname] || 0) - (voteCounts[a.nickname] || 0))

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-5">
        <div className="container mx-auto px-4 max-w-2xl text-center">
          <h2 className="text-4xl font-bold mb-8 text-white tracking-tight">Results</h2>
          
          <div className="w-full space-y-4">
            {sortedPlayers.map(player => {
              const count = voteCounts[player.nickname] || 0
              const percentage = activePlayers.length > 0 ? (count / activePlayers.length) * 100 : 0
              const isWinner = winners.includes(player.nickname)
              const isRemoved = removedPlayers.includes(player.nickname)
              const votersForPlayer = resultsVotes.filter(v => v.voted_for === player.nickname)
              
              return (
                <div key={player.nickname} className={`w-full p-4 bg-zinc-900/50 rounded-xl border ${isWinner ? 'border-indigo-500 ring-2 ring-indigo-500/50' : 'border-slate-800'} ${isRemoved ? 'opacity-50' : ''} transition-all duration-300 ease-in-out`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="flex items-center font-medium text-slate-200">
                      {player.emoji && <span className="mr-2 text-2xl">{player.emoji}</span>}
                      {player.nickname}{isRemoved ? ' (removed)' : ''}
                    </span>
                    <span className="font-semibold text-white">{count} votes</span>
                  </div>
                  <div 
                    className="h-2 bg-zinc-800 rounded-full overflow-hidden"
                    style={{ width: `${percentage}%` }}
                  >
                    <div className={`h-full transition-all duration-300 ease-in-out ${isWinner ? 'bg-indigo-500' : 'bg-slate-600'}`} style={{ width: '100%' }} />
                  </div>
                  {showDetailedVotes && votersForPlayer.length > 0 && (
                    <div className="mt-2 text-sm text-slate-400">
                      Voted by: {votersForPlayer.map(v => v.voter_nickname).join(', ')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          
          {winners.length > 0 && (
            <div className="mt-8 text-2xl font-bold text-white">
              {winners.length === 1 ? (
                <h3>{winners[0]} drinks! 🍺</h3>
              ) : (
                <h3>{winners.join(' & ')} drink! 🍺</h3>
              )}
            </div>
          )}
          
          {isHost && (
            <div className="flex gap-4 justify-center flex-wrap mt-8">
              <button className="text-lg font-semibold py-4 px-8 rounded-xl border-none cursor-pointer transition-all duration-300 ease-in-out hover:bg-indigo-600 active:scale-95 min-w-[200px] bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" onClick={handleNextRound}>
                Next Round
              </button>
              <button 
                className="text-lg font-semibold py-4 px-8 rounded-xl border-none cursor-pointer transition-all duration-300 ease-in-out hover:bg-indigo-600 active:scale-95 min-w-[200px] bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                onClick={handleShowSummary}
              >
                Drinks So Far
              </button>
              <button 
                className="text-lg font-semibold py-4 px-8 rounded-xl border-none cursor-pointer transition-all duration-300 ease-in-out hover:bg-slate-700 active:scale-95 min-w-[200px] bg-slate-600 text-white"
                onClick={async () => {
                  setShowDetailedVotes(true)
                  await supabase
                    .channel(`reveal_votes:${code.toLowerCase()}`)
                    .send({
                      type: 'broadcast',
                      event: 'reveal_votes',
                      payload: { roundNumber }
                    })
                }}
                disabled={showDetailedVotes}
              >
                {showDetailedVotes ? 'Votes Revealed' : 'Reveal Votes'}
              </button>
              <button 
                className="text-lg font-semibold py-4 px-8 rounded-xl border-none cursor-pointer transition-all duration-300 ease-in-out hover:bg-red-500 active:scale-95 min-w-[200px] bg-red-600 text-white shadow-lg shadow-red-600/20"
                onClick={handleEndGame}
              >
                End Game
              </button>
            </div>
          )}

          {isHost && (
            <div className="mt-8 w-full max-w-md mx-auto">
              <h3 className="text-xl font-semibold mb-4 text-white">Players ({activePlayers.length})</h3>
              <ul className="list-none p-0 space-y-3">
                {activePlayers.map((player, index) => (
                  <li key={index} className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-xl border border-slate-800 transition-all duration-300 ease-in-out hover:bg-zinc-800/50">
                    <span className="flex items-center font-medium text-slate-200">
                      {player.emoji && <span className="mr-2 text-2xl">{player.emoji}</span>}
                      {player.nickname}
                    </span>
                    <button 
                      className="ml-2 text-sm text-red-400 bg-none border-none cursor-pointer hover:text-red-300 transition-all duration-300 ease-in-out"
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
      </div>
    )
  }

  const votingPlayers = players

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-5">
      <div className="container mx-auto px-4 max-w-2xl text-center">
        <div className="text-lg mb-2 font-semibold text-white">Time left: {timeLeft}s</div>
        
        {/* Live vote counter */}
        <div className="text-sm text-slate-400 mb-2">
          {new Set(votes.map(v => v.voter_nickname)).size} / {players.length} votes cast
        </div>
        
        {/* Debug info */}
        <div className="text-xs text-zinc-600 mb-2">
          Players: {players.length} | Votes: {votes.length} | Round: {roundNumber}
        </div>
        
        <div key={room.current_question} className="w-full bg-zinc-900/50 p-8 rounded-2xl border border-slate-800 mb-8 shadow-xl animate-fade-in-up">
          <h2 className="text-2xl font-bold text-center text-white">{room.current_question}</h2>
        </div>
        
        <div className="w-full">
          <h3 className="text-xl font-semibold mb-4 text-white">Vote for:</h3>
          <div key={roundNumber} className="grid grid-cols-1 md:grid-cols-2 gap-4" style={hasVoted ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
            {votingPlayers.map((player, index) => {
              const isSelf = player.nickname === myNickname
              return (
                <button
                  key={`${player.nickname}-${roundNumber}`}
                  className={`text-lg font-semibold py-4 px-6 rounded-xl border-none cursor-pointer transition-all duration-300 ease-in-out hover:bg-indigo-600 active:scale-95 shadow-lg animate-fade-in-up ${isSelf ? 'opacity-50 cursor-not-allowed bg-zinc-700 text-slate-400' : 'bg-indigo-500 text-white shadow-indigo-500/20'}`}
                  style={{ animationDelay: `${index * 75}ms`, opacity: 0 }}
                  onClick={() => handleVote(player.nickname)}
                  disabled={hasVoted || isSelf}
                >
                  {player.nickname} {isSelf && '(You)'}
                </button>
              )
            })}
          </div>
        </div>
        
        {hasVoted && <p className="mt-4 text-slate-400 font-medium">Vote submitted! Waiting for other players...</p>}
      </div>
    </div>
  )
}

export default Game

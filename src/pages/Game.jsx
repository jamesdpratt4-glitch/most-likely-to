import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Game() {
  const { code } = useParams()
  const [searchParams] = useSearchParams()
  const isHost = searchParams.get('host') === 'true'
  
  const [room, setRoom] = useState(null)
  const [players, setPlayers] = useState([])
  const [votes, setVotes] = useState([])
  const [hasVoted, setHasVoted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(15)
  const [showResults, setShowResults] = useState(false)
  const [roundNumber, setRoundNumber] = useState(1)
  const [winner, setWinner] = useState(null)
  
  const myNickname = localStorage.getItem('nickname')

  useEffect(() => {
    // Fetch initial room data
    fetchRoom()
    fetchPlayers()
    fetchVotes()

    // Subscribe to room changes
    const roomChannel = supabase
      .channel(`room:${code}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `code=eq.${code}`
        },
        (payload) => {
          setRoom(payload.new)
          // If room status changes to 'waiting', redirect to lobby
          if (payload.new.status === 'waiting') {
            window.location.href = isHost ? `/host/${code}` : `/lobby/${code}`
          }
          // If current_question changes (new round), reset voting state
          if (payload.old.current_question !== payload.new.current_question) {
            setShowResults(false)
            setHasVoted(false)
            setTimeLeft(15)
            setVotes([])
            setWinner(null)
            setRoundNumber(prev => prev + 1)
          }
        }
      )
      .subscribe()

    // Subscribe to players changes
    const playersChannel = supabase
      .channel(`players:${code}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_code=eq.${code}`
        },
        () => {
          fetchPlayers()
        }
      )
      .subscribe()

    // Subscribe to votes changes
    const votesChannel = supabase
      .channel(`votes:${code}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
          filter: `room_code=eq.${code}`
        },
        () => {
          fetchVotes()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(roomChannel)
      supabase.removeChannel(playersChannel)
      supabase.removeChannel(votesChannel)
    }
  }, [code, isHost])

  useEffect(() => {
    if (room && room.status === 'playing' && !showResults) {
      // Start countdown when game starts
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            endVoting()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [room, showResults])

  useEffect(() => {
    // Check if all players have voted
    if (players.length > 0 && votes.length >= players.length && !showResults) {
      endVoting()
    }
  }, [votes, players, showResults])

  const fetchRoom = async () => {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single()
    
    if (data) {
      setRoom(data)
      // Calculate round number from existing votes
      const { data: existingVotes } = await supabase
        .from('votes')
        .select('round_number')
        .eq('room_code', code)
      
      if (existingVotes && existingVotes.length > 0) {
        const maxRound = Math.max(...existingVotes.map(v => v.round_number))
        setRoundNumber(maxRound + 1)
      }
    }
  }

  const fetchPlayers = async () => {
    const { data } = await supabase
      .from('players')
      .select('nickname, drink_count')
      .eq('room_code', code)
    
    if (data) {
      setPlayers(data)
    }
  }

  const fetchVotes = async () => {
    const { data } = await supabase
      .from('votes')
      .select('*')
      .eq('room_code', code)
      .eq('round_number', roundNumber)
    
    if (data) {
      setVotes(data)
      // Check if current player has voted
      const myVote = data.find(v => v.voter_nickname === myNickname)
      setHasVoted(!!myVote)
    }
  }

  const handleVote = async (votedFor) => {
    if (hasVoted) return

    const { error } = await supabase
      .from('votes')
      .insert({
        room_code: code,
        round_number: roundNumber,
        voter_nickname: myNickname,
        voted_for: votedFor
      })
    
    if (!error) {
      setHasVoted(true)
    }
  }

  const endVoting = async () => {
    setShowResults(true)
    
    // Calculate winner
    const voteCounts = {}
    votes.forEach(vote => {
      voteCounts[vote.voted_for] = (voteCounts[vote.voted_for] || 0) + 1
    })
    
    let maxVotes = 0
    let roundWinner = null
    for (const [nickname, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count
        roundWinner = nickname
      }
    }
    
    setWinner(roundWinner)
    
    // Update winner's drink count
    if (roundWinner) {
      await supabase
        .from('players')
        .update({ drink_count: supabase.raw('drink_count + 1') })
        .eq('room_code', code)
        .eq('nickname', roundWinner)
    }
  }

  const handleNextRound = async () => {
    const { questions } = await import('../data/questions')
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)]
    
    const newRoundNumber = roundNumber + 1
    
    await supabase
      .from('rooms')
      .update({
        current_question: randomQuestion
      })
      .eq('code', code)
    
    // Reset state for new round
    setShowResults(false)
    setHasVoted(false)
    setTimeLeft(15)
    setVotes([])
    setWinner(null)
    setRoundNumber(newRoundNumber)
  }

  if (!room || room.status === 'waiting') {
    return <div className="game">Loading...</div>
  }

  if (showResults) {
    const voteCounts = {}
    votes.forEach(vote => {
      voteCounts[vote.voted_for] = (voteCounts[vote.voted_for] || 0) + 1
    })
    
    const maxVotes = Math.max(...Object.values(voteCounts), 0)

    return (
      <div className="game results">
        <h2 className="results-title">Results</h2>
        
        <div className="vote-chart">
          {players.map(player => {
            const count = voteCounts[player.nickname] || 0
            const percentage = players.length > 0 ? (count / players.length) * 100 : 0
            const isWinner = player.nickname === winner
            
            return (
              <div key={player.nickname} className={`vote-bar ${isWinner ? 'winner' : ''}`}>
                <div className="vote-bar-label">
                  <span>{player.nickname}</span>
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
        
        {winner && (
          <div className="winner-message">
            <h3>{winner} drinks! 🍺</h3>
          </div>
        )}
        
        {isHost && (
          <button className="btn btn-primary btn-large" onClick={handleNextRound}>
            Next Round
          </button>
        )}
      </div>
    )
  }

  const otherPlayers = players.filter(p => p.nickname !== myNickname)

  return (
    <div className="game">
      <div className="timer">Time left: {timeLeft}s</div>
      
      <div className="question-card">
        <h2 className="question-text">{room.current_question}</h2>
      </div>
      
      <div className="players-section">
        <h3>Vote for:</h3>
        <div className="vote-buttons">
          {otherPlayers.map(player => (
            <button
              key={player.nickname}
              className={`btn vote-btn ${hasVoted ? 'disabled' : ''}`}
              onClick={() => handleVote(player.nickname)}
              disabled={hasVoted}
            >
              {player.nickname}
            </button>
          ))}
        </div>
      </div>
      
      {hasVoted && <p className="voted-message">Vote submitted!</p>}
    </div>
  )
}

export default Game

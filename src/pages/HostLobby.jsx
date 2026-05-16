import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { questions } from '../data/questions'
import QRCode from 'react-qr-code'

function HostLobby() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [players, setPlayers] = useState([])

  useEffect(() => {
    const validateAndLoad = async () => {
      // Verify this user is the host
      const isHost = localStorage.getItem('isHost') === 'true'
      const storedRoomCode = localStorage.getItem('roomCode')
      const nickname = localStorage.getItem('nickname')
      
      if (!isHost || storedRoomCode !== code || !nickname) {
        navigate('/')
        return
      }

      // Verify room still exists
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code)
        .single()

      if (roomError || !room) {
        localStorage.removeItem('nickname')
        localStorage.removeItem('roomCode')
        localStorage.removeItem('isHost')
        navigate('/')
        return
      }

      // Verify host is still in the players table
      const { data: playerData } = await supabase
        .from('players')
        .select('nickname')
        .eq('room_code', code)
        .eq('nickname', nickname)
        .single()

      if (!playerData) {
        localStorage.removeItem('nickname')
        localStorage.removeItem('roomCode')
        localStorage.removeItem('isHost')
        navigate('/')
        return
      }

      // Fetch initial players
      fetchPlayers()

      // Poll players every 2 seconds instead of subscription (to avoid conflicts)
      const playersInterval = setInterval(() => {
        fetchPlayers()
      }, 2000)

      return () => {
        clearInterval(playersInterval)
      }
    }

    validateAndLoad()
  }, [code, navigate])

  const fetchPlayers = async () => {
    const { data, error } = await supabase
      .from('players')
      .select('nickname')
      .eq('room_code', code)
    
    if (data) {
      setPlayers(data.map(p => p.nickname))
    }
  }

  const handleStartGame = async () => {
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)]
    
    // Clear old votes for this room before starting new game
    await supabase
      .from('votes')
      .delete()
      .eq('room_code', code)
    
    // Calculate round end time (15 seconds from now)
    const roundEndTime = new Date(Date.now() + 15 * 1000).toISOString()
    
    const { error } = await supabase
      .from('rooms')
      .update({
        status: 'playing',
        current_question: randomQuestion,
        round_number: 1,
        round_end_time: roundEndTime
      })
      .eq('code', code)
    
    if (!error) {
      navigate(`/game/${code}?host=true`)
    }
  }

  return (
    <div className="host-lobby">
      <p className="room-label">Room Code</p>
      <h1 className="room-code">{code}</h1>
      
      <div className="qr-section">
        <p className="qr-label">Scan to join</p>
        <div className="qr-code">
          <QRCode 
            value={`${window.location.origin}/join/${code}`}
            size={200}
            level="M"
          />
        </div>
      </div>
      
      <div className="players-section">
        <h2>Players ({players.length})</h2>
        <ul className="players-list">
          {players.map((nickname, index) => (
            <li key={index} className="player-item">{nickname}</li>
          ))}
        </ul>
      </div>

      <button 
        className="btn btn-primary btn-large" 
        onClick={handleStartGame}
        disabled={players.length < 2}
        style={players.length < 2 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
      >
        Start Game
      </button>
      {players.length < 2 && (
        <p style={{ marginTop: '1rem', color: '#a0a0a0', fontSize: '0.9rem' }}>
          Need at least 2 players to start
        </p>
      )}
    </div>
  )
}

export default HostLobby

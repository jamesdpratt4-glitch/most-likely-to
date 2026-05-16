import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { questions } from '../data/questions'

function HostLobby() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [players, setPlayers] = useState([])

  useEffect(() => {
    // Verify this user is the host
    const isHost = localStorage.getItem('isHost') === 'true'
    const storedRoomCode = localStorage.getItem('roomCode')
    
    if (!isHost || storedRoomCode !== code) {
      navigate('/')
      return
    }

    // Fetch initial players
    fetchPlayers()

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`players:${code}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_code=eq.${code}`
        },
        (payload) => {
          fetchPlayers()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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
    
    const { error } = await supabase
      .from('rooms')
      .update({
        status: 'playing',
        current_question: randomQuestion
      })
      .eq('code', code)
    
    if (!error) {
      navigate(`/game/${code}?host=true`)
    }
  }

  return (
    <div className="host-lobby">
      <h1 className="room-code">{code}</h1>
      <p className="room-label">Room Code</p>
      
      <div className="players-section">
        <h2>Players ({players.length})</h2>
        <ul className="players-list">
          {players.map((nickname, index) => (
            <li key={index} className="player-item">{nickname}</li>
          ))}
        </ul>
      </div>

      <button className="btn btn-primary btn-large" onClick={handleStartGame}>Start Game</button>
    </div>
  )
}

export default HostLobby

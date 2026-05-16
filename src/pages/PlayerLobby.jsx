import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function PlayerLobby() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [players, setPlayers] = useState([])

  useEffect(() => {
    const validateAndLoad = async () => {
      // Verify user has required localStorage data
      const storedRoomCode = localStorage.getItem('roomCode')
      const nickname = localStorage.getItem('nickname')
      
      if (storedRoomCode !== code || !nickname) {
        navigate('/')
        return
      }

      // Verify room still exists and is in waiting state
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code)
        .eq('status', 'waiting')
        .single()

      if (roomError || !room) {
        localStorage.removeItem('nickname')
        localStorage.removeItem('roomCode')
        localStorage.removeItem('isHost')
        navigate('/')
        return
      }

      // Verify player is still in the players table
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

      // Subscribe to room changes to detect when game starts
      const roomChannel = supabase
        .channel(`room:${code}:lobby`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rooms',
            filter: `code=eq.${code}`
          },
          (payload) => {
            if (payload.new.status === 'playing') {
              navigate(`/game/${code}`)
            }
          }
        )
        .subscribe()

      return () => {
        clearInterval(playersInterval)
        supabase.removeChannel(roomChannel)
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

  return (
    <div className="player-lobby">
      <h1 className="waiting-message">Waiting for host to start...</h1>
      
      <div className="players-section">
        <h2>Players ({players.length})</h2>
        <ul className="players-list">
          {players.map((nickname, index) => (
            <li key={index} className="player-item">{nickname}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default PlayerLobby

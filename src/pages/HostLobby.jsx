import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function HostLobby() {
  const { code } = useParams()
  const [players, setPlayers] = useState([])

  useEffect(() => {
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
  }, [code])

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

      <button className="btn btn-primary btn-large">Start Game</button>
    </div>
  )
}

export default HostLobby

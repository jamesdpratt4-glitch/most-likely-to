import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function PlayerLobby() {
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

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
      .select('nickname, emoji')
      .eq('room_code', code)
    
    if (data) {
      setPlayers(data)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-5">
      <div className="container mx-auto px-4 max-w-2xl text-center">
        <h1 className="text-3xl font-semibold mb-8 text-white">Waiting for host to start...</h1>
        
        <div className="w-full max-w-md mx-auto">
          <h2 className="text-2xl font-semibold mb-4 text-white">Players ({players.length})</h2>
          <ul className="list-none p-0 space-y-3">
            {players.map((player, index) => (
              <li key={index} className="flex items-center gap-3 p-4 bg-zinc-900/50 rounded-xl border border-slate-800 transition-all duration-300 ease-in-out hover:bg-zinc-800/50">
                {player.emoji && <span className="text-2xl">{player.emoji}</span>}
                <span className="font-medium text-slate-200">{player.nickname}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default PlayerLobby

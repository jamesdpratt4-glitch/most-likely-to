import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { questions } from '../data/questions'
import QRCode from 'qrcode'

function HostLobby() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [players, setPlayers] = useState([])
  const [qrDataUrl, setQrDataUrl] = useState('')

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

      // Generate QR code data URL after component is mounted
      const appUrl = import.meta.env.VITE_APP_URL || 'https://most-likely-to-git-main-jamesglitch-projects.vercel.app'
      const joinUrl = `${appUrl}/join/${code}`
      console.log('QR Code URL:', joinUrl)
      console.log('Using appUrl:', appUrl)
      QRCode.toDataURL(joinUrl, { width: 200, margin: 1 }, (err, url) => {
        if (err) {
          console.error('Error generating QR code:', err)
        } else {
          console.log('QR Code generated successfully')
          setQrDataUrl(url)
        }
      })

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
      .select('nickname, emoji')
      .eq('room_code', code)
    
    if (data) {
      setPlayers(data)
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-5">
      <div className="container mx-auto px-4 max-w-2xl text-center">
        <p className="text-slate-400 mb-2 text-sm font-medium uppercase tracking-wide">Room Code</p>
        <h1 className="text-7xl font-bold mb-8 text-white tracking-tight">{code}</h1>
        
        <div className="mb-8 flex flex-col items-center">
          <p className="text-slate-400 mb-4 text-sm font-medium">Scan to join</p>
          <div className="bg-white p-4 rounded-2xl inline-block shadow-2xl shadow-white/10">
            {qrDataUrl && <img src={qrDataUrl} alt="QR Code" className="w-[200px] h-[200px]" />}
          </div>
        </div>
        
        <div className="mb-8 w-full max-w-md mx-auto">
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

        <button 
          className="text-lg font-semibold py-4 px-8 rounded-xl border-none cursor-pointer transition-all duration-300 ease-in-out hover:bg-indigo-600 active:scale-95 min-w-[200px] bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-500 disabled:active:scale-100"
          onClick={handleStartGame}
          disabled={players.length < 2}
        >
          Start Game
        </button>
        {players.length < 2 && (
          <p className="mt-4 text-slate-400 text-sm font-medium">
            Need at least 2 players to start
          </p>
        )}
      </div>
    </div>
  )
}

export default HostLobby

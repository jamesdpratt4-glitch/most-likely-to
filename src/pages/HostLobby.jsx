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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f0f] text-white p-5">
      <p className="text-gray-400 mb-2">Room Code</p>
      <h1 className="text-6xl font-bold mb-8 text-[#667eea]">{code}</h1>
      
      <div className="mb-8 text-center">
        <p className="text-gray-400 mb-2">Scan to join</p>
        <div className="bg-white p-2 rounded-lg inline-block">
          {qrDataUrl && <img src={qrDataUrl} alt="QR Code" className="w-[200px] h-[200px]" />}
        </div>
      </div>
      
      <div className="mb-8 w-full max-w-md">
        <h2 className="text-2xl font-medium mb-4">Players ({players.length})</h2>
        <ul className="list-none p-0 space-y-2">
          {players.map((player, index) => (
            <li key={index} className="flex items-center gap-2 p-3 bg-[#1a1a2e] rounded-lg">
              {player.emoji && <span className="mr-2">{player.emoji}</span>}
              {player.nickname}
            </li>
          ))}
        </ul>
      </div>

      <button 
        className="text-xl font-semibold py-4 px-10 rounded-lg border-none cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-lg min-w-[200px] bg-[#667eea] text-white"
        onClick={handleStartGame}
        disabled={players.length < 2}
        style={players.length < 2 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
      >
        Start Game
      </button>
      {players.length < 2 && (
        <p className="mt-4 text-gray-400 text-sm">
          Need at least 2 players to start
        </p>
      )}
    </div>
  )
}

export default HostLobby

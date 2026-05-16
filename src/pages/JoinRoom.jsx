import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { assignRandomEmoji } from '../lib/emojis'

function JoinRoom() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleJoin = async () => {
    setError('')
    setLoading(true)

    if (!nickname.trim()) {
      setError('Please enter a nickname')
      setLoading(false)
      return
    }

    try {
      // Check if room exists
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('status')
        .eq('code', roomCode.toUpperCase())
        .single()

      if (roomError || !roomData) {
        setError('Room not found')
        setLoading(false)
        return
      }

      if (roomData.status === 'ended') {
        setError('This game has ended')
        setLoading(false)
        return
      }

      // Check if nickname already exists in room
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('nickname')
        .eq('room_code', roomCode.toUpperCase())
        .eq('nickname', nickname.trim())
        .single()

      if (existingPlayer) {
        setError('This nickname is already taken in this room')
        setLoading(false)
        return
      }

      // Add player to room
      // Get existing emojis in the room to avoid duplicates
      const { data: existingPlayers } = await supabase
        .from('players')
        .select('emoji')
        .eq('room_code', roomCode.toUpperCase())
      
      const existingEmojis = existingPlayers?.map(p => p.emoji).filter(Boolean) || []
      const emoji = assignRandomEmoji(existingEmojis)

      const { error: insertError } = await supabase
        .from('players')
        .insert({
          room_code: roomCode.toUpperCase(),
          nickname: nickname.trim(),
          emoji,
          drink_count: 0
        })

      if (insertError) {
        setError('Failed to join room')
        setLoading(false)
        return
      }

      // Save to localStorage
      localStorage.setItem('nickname', nickname.trim())
      localStorage.setItem('roomCode', roomCode.toUpperCase())
      localStorage.setItem('isHost', 'false')

      navigate(`/game/${roomCode.toUpperCase()}`)
    } catch (err) {
      setError('Failed to join room')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-5">
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 font-semibold text-zinc-500 bg-zinc-900/70 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-800">
        v1.0.95
      </div>
      <div className="container mx-auto px-4 max-w-2xl text-center">
        <h1 className="text-6xl font-bold mb-8 text-white tracking-tight">Most Likely To</h1>
        <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
          <h2 className="text-2xl font-semibold text-white">Join Room</h2>
          <div className="w-full">
            <label className="block mb-2 text-sm font-medium text-slate-400">Room Code</label>
            <input
              type="text"
              value={roomCode?.toUpperCase() || ''}
              readOnly
              className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-zinc-900/50 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300 ease-in-out"
            />
          </div>
          <div className="w-full">
            <label className="block mb-2 text-sm font-medium text-slate-400">Your Nickname</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter your nickname"
              maxLength={20}
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-zinc-900/50 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300 ease-in-out"
            />
          </div>
          {error && <div className="text-red-400 font-medium">{error}</div>}
          <button 
            onClick={handleJoin} 
            className="text-lg font-semibold py-4 px-8 rounded-xl border-none cursor-pointer transition-all duration-300 ease-in-out hover:bg-indigo-600 active:scale-95 min-w-[200px] bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-500 disabled:active:scale-100"
            disabled={loading}
          >
            {loading ? 'Joining...' : 'Join Room'}
          </button>
          <button 
            onClick={() => navigate('/')} 
            className="text-lg font-semibold py-4 px-8 rounded-xl border-none cursor-pointer transition-all duration-300 ease-in-out hover:bg-slate-700 active:scale-95 min-w-[200px] bg-slate-600 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-600 disabled:active:scale-100"
            disabled={loading}
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}

export default JoinRoom

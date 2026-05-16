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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f0f] text-white p-5">
      <div className="fixed top-2.5 left-1/2 -translate-x-1/2 opacity-70 text-base text-black z-50 font-bold bg-white/90 px-3 py-1 rounded shadow">
        v1.0.93
      </div>
      <h1 className="text-6xl font-bold mb-8 text-[#667eea]">Most Likely To</h1>
      <div className="flex flex-col items-center gap-4 w-full max-w-md">
        <h2 className="text-2xl font-medium">Join Room</h2>
        <div className="w-full">
          <label className="block mb-2 text-gray-400">Room Code</label>
          <input
            type="text"
            value={roomCode?.toUpperCase() || ''}
            readOnly
            className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-[#1a1a2e] text-white"
          />
        </div>
        <div className="w-full">
          <label className="block mb-2 text-gray-400">Your Nickname</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Enter your nickname"
            maxLength={20}
            autoFocus
            className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-[#1a1a2e] text-white focus:outline-none focus:ring-2 focus:ring-[#667eea]"
          />
        </div>
        {error && <div className="text-[#ff6b6b]">{error}</div>}
        <button 
          onClick={handleJoin} 
          className="text-xl font-semibold py-4 px-10 rounded-lg border-none cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-lg min-w-[200px] bg-[#667eea] text-white"
          disabled={loading}
        >
          {loading ? 'Joining...' : 'Join Room'}
        </button>
        <button 
          onClick={() => navigate('/')} 
          className="text-xl font-semibold py-4 px-10 rounded-lg border-none cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-lg min-w-[200px] bg-[#ff6b6b] text-white"
          disabled={loading}
        >
          Back to Home
        </button>
      </div>
    </div>
  )
}

export default JoinRoom

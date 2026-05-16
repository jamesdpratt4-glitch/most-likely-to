import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { assignRandomEmoji } from '../lib/emojis'
import '../App.css'

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
    <div className="home">
      <div className="version">v1.0.74</div>
      <h1 className="title">Most Likely To</h1>
      <div className="join-form">
        <h2>Join Room</h2>
        <div className="form-group">
          <label>Room Code</label>
          <input
            type="text"
            value={roomCode?.toUpperCase() || ''}
            readOnly
            className="readonly-input"
          />
        </div>
        <div className="form-group">
          <label>Your Nickname</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Enter your nickname"
            maxLength={20}
            autoFocus
          />
        </div>
        {error && <div className="error">{error}</div>}
        <button 
          onClick={handleJoin} 
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? 'Joining...' : 'Join Room'}
        </button>
        <button 
          onClick={() => navigate('/')} 
          className="btn btn-secondary"
          disabled={loading}
        >
          Back to Home
        </button>
      </div>
    </div>
  )
}

export default JoinRoom

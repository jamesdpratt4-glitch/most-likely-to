import { useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import HostLobby from './pages/HostLobby'
import PlayerLobby from './pages/PlayerLobby'
import Game from './pages/Game'
import './App.css'

function Home() {
  const navigate = useNavigate()
  const [showJoinForm, setShowJoinForm] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')

  const generateRoomCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString()
  }

  const handleCreateRoom = async () => {
    const code = generateRoomCode()
    
    const { error } = await supabase
      .from('rooms')
      .insert({ code, status: 'waiting' })
    
    if (!error) {
      navigate(`/host/${code}`)
    } else {
      console.error('Error creating room:', error)
    }
  }

  const handleJoinRoom = async (e) => {
    e.preventDefault()
    setError('')

    // Validate room exists and status is waiting
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', roomCode)
      .eq('status', 'waiting')
      .single()

    if (roomError || !room) {
      setError('Invalid room code or room is not accepting players')
      return
    }

    // Insert player into players table
    const { error: playerError } = await supabase
      .from('players')
      .insert({
        room_code: roomCode,
        nickname,
        drink_count: 0,
        last_seen: new Date().toISOString()
      })

    if (playerError) {
      setError('Failed to join room. Please try again.')
      return
    }

    // Store nickname in localStorage
    localStorage.setItem('nickname', nickname)
    localStorage.setItem('roomCode', roomCode)

    navigate(`/lobby/${roomCode}`)
  }

  return (
    <div className="app">
      <h1 className="title">Most Likely To</h1>
      <p className="subtitle">A multiplayer party game</p>
      
      {!showJoinForm ? (
        <div className="buttons">
          <button className="btn btn-primary" onClick={handleCreateRoom}>Create Room</button>
          <button className="btn btn-secondary" onClick={() => setShowJoinForm(true)}>Join Room</button>
        </div>
      ) : (
        <form className="join-form" onSubmit={handleJoinRoom}>
          <input
            type="text"
            placeholder="Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            className="input-field"
            maxLength={4}
          />
          <input
            type="text"
            placeholder="Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="input-field"
          />
          {error && <p className="error-message">{error}</p>}
          <div className="buttons">
            <button type="submit" className="btn btn-primary">Join</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowJoinForm(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/host/:code" element={<HostLobby />} />
      <Route path="/lobby/:code" element={<PlayerLobby />} />
      <Route path="/game/:code" element={<Game />} />
    </Routes>
  )
}

export default App

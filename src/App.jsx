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
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [hostNickname, setHostNickname] = useState('')
  const [error, setError] = useState('')

  const generateRoomCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString()
  }

  const handleCreateRoom = async () => {
    if (!hostNickname.trim()) {
      setError('Please enter a nickname')
      return
    }

    const code = generateRoomCode()
    
    const { error: roomError } = await supabase
      .from('rooms')
      .insert({ code, status: 'waiting' })
    
    if (roomError) {
      console.error('Error creating room:', roomError)
      setError('Failed to create room. Please try again.')
      return
    }

    // Insert host into players table
    const { error: playerError } = await supabase
      .from('players')
      .insert({
        room_code: code,
        nickname: hostNickname,
        drink_count: 0,
        last_seen: new Date().toISOString()
      })

    if (playerError) {
      console.error('Error adding host to players:', playerError)
      setError('Failed to join room. Please try again.')
      return
    }

    // Store host info in localStorage
    localStorage.setItem('nickname', hostNickname)
    localStorage.setItem('roomCode', code)
    localStorage.setItem('isHost', 'true')

    navigate(`/host/${code}`)
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
      
      {!showJoinForm && !showCreateForm ? (
        <div className="buttons">
          <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>Create Room</button>
          <button className="btn btn-secondary" onClick={() => setShowJoinForm(true)}>Join Room</button>
        </div>
      ) : showCreateForm ? (
        <form className="join-form" onSubmit={(e) => { e.preventDefault(); handleCreateRoom(); }}>
          <input
            type="text"
            placeholder="Your Nickname"
            value={hostNickname}
            onChange={(e) => setHostNickname(e.target.value)}
            className="input-field"
          />
          {error && <p className="error-message">{error}</p>}
          <div className="buttons">
            <button type="submit" className="btn btn-primary">Create</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowCreateForm(false); setError(''); }}>Cancel</button>
          </div>
        </form>
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
            <button type="button" className="btn btn-secondary" onClick={() => { setShowJoinForm(false); setError(''); }}>Cancel</button>
          </div>
        </form>
      )}
      
      <div className="version-number" style={{ position: 'fixed', bottom: '10px', right: '10px', opacity: 0.3, fontSize: '12px', color: '#666' }}>
        v{__APP_VERSION__}
      </div>
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

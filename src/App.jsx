import { useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { assignRandomEmoji } from './lib/emojis'
import HostLobby from './pages/HostLobby'
import PlayerLobby from './pages/PlayerLobby'
import Game from './pages/Game'
import GameOver from './pages/GameOver'
import JoinRoom from './pages/JoinRoom'
import './App.css'

const APP_VERSION = "1.0.92"

function Home() {
  const navigate = useNavigate()
  const [showJoinForm, setShowJoinForm] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [hostNickname, setHostNickname] = useState('')
  const [error, setError] = useState('')
  const [showDevModal, setShowDevModal] = useState(false)
  const [activeRooms, setActiveRooms] = useState([])

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
    const emoji = assignRandomEmoji()
    const { error: playerError } = await supabase
      .from('players')
      .insert({
        room_code: code,
        nickname: hostNickname,
        emoji,
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

    // Check if nickname already exists in the room
    const { data: existingPlayers } = await supabase
      .from('players')
      .select('nickname')
      .eq('room_code', roomCode)
      .eq('nickname', nickname)

    if (existingPlayers && existingPlayers.length > 0) {
      setError('This nickname is already taken. Please choose another.')
      return
    }

    // Insert player into room
    // Get existing emojis in the room to avoid duplicates
    const { data: existingPlayersInRoom } = await supabase
      .from('players')
      .select('emoji')
      .eq('room_code', roomCode)
    
    const existingEmojis = existingPlayersInRoom?.map(p => p.emoji).filter(Boolean) || []
    const emoji = assignRandomEmoji(existingEmojis)

    const { error: playerError } = await supabase
      .from('players')
      .insert({
        room_code: roomCode,
        nickname: nickname,
        emoji,
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

  const fetchActiveRooms = async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
    
    if (data) {
      setActiveRooms(data)
    }
  }

  const killAllRooms = async () => {
    const { error } = await supabase
      .from('rooms')
      .delete()
      .not('code', 'is', null)
    
    const { error: playersError } = await supabase
      .from('players')
      .delete()
      .not('nickname', 'is', null)
    
    const { error: votesError } = await supabase
      .from('votes')
      .delete()
      .not('voter_nickname', 'is', null)
    
    if (!error && !playersError && !votesError) {
      setActiveRooms([])
      alert('All rooms have been killed successfully')
    }
  }

  const handleDevClick = () => {
    fetchActiveRooms()
    setShowDevModal(true)
  }

  return (
    <div className="app">
      <div className="version-number" style={{ position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)', opacity: 0.7, fontSize: '16px', color: '#000000', zIndex: 9999, fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.9)', padding: '4px 12px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        v{APP_VERSION}
      </div>
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
            className="input"
          />
          {error && <p className="error-message">{error}</p>}
          <div className="form-buttons">
            <button type="submit" className="btn btn-primary">Create</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowCreateForm(false); setError(''); }}>Cancel</button>
          </div>
        </form>
      ) : (
        <form className="form" onSubmit={handleJoinRoom}>
          <h2>Join Room</h2>
          <input
            type="text"
            placeholder="Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            className="input"
            maxLength={4}
          />
          <input
            type="text"
            placeholder="Your Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="input"
          />
          {error && <p className="error-message">{error}</p>}
          <div className="form-buttons">
            <button type="submit" className="btn btn-primary">Join</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowJoinForm(false); setError(''); }}>Cancel</button>
          </div>
        </form>
      )}
      
      <button 
        className="dev-button" 
        onClick={handleDevClick}
        style={{ position: 'fixed', bottom: '10px', left: '10px', opacity: 0.3, fontSize: '10px', color: '#666', zIndex: 9999, background: 'none', border: 'none', cursor: 'pointer' }}
      >
        DEV
      </button>
      
      {showDevModal && (
        <div className="dev-modal" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '8px', zIndex: 10000, minWidth: '400px', maxHeight: '80vh', overflow: 'auto' }}>
          <h2 style={{ color: '#ffffff', marginBottom: '1rem' }}>Dev Tools</h2>
          <h3 style={{ color: '#a0a0a0', marginBottom: '0.5rem' }}>Active Rooms ({activeRooms.length})</h3>
          <div style={{ marginBottom: '1rem', maxHeight: '200px', overflow: 'auto' }}>
            {activeRooms.length === 0 ? (
              <p style={{ color: '#666' }}>No active rooms</p>
            ) : (
              <ul style={{ color: '#a0a0a0', listStyle: 'none', padding: 0 }}>
                {activeRooms.map(room => (
                  <li key={room.code} style={{ marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: '#2a2a2a', borderRadius: '4px' }}>
                    <strong>Code:</strong> {room.code} | <strong>Status:</strong> {room.status}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button 
            className="btn btn-primary" 
            onClick={killAllRooms}
            style={{ backgroundColor: '#ff4444', marginRight: '0.5rem' }}
          >
            Kill All Rooms
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowDevModal(false)}
          >
            Close
          </button>
        </div>
      )}
      
      {showDevModal && (
        <div 
          className="dev-modal-overlay"
          onClick={() => setShowDevModal(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 9999 }}
        />
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
      <Route path="/game-over" element={<GameOver />} />
      <Route path="/join/:roomCode" element={<JoinRoom />} />
    </Routes>
  )
}

export default App

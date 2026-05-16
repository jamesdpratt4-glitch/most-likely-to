import { useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { assignRandomEmoji } from './lib/emojis'
import HostLobby from './pages/HostLobby'
import PlayerLobby from './pages/PlayerLobby'
import Game from './pages/Game'
import GameOver from './pages/GameOver'
import JoinRoom from './pages/JoinRoom'

const APP_VERSION = "1.0.93"

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f0f] text-white p-5">
      <div className="fixed top-2.5 left-1/2 -translate-x-1/2 opacity-70 text-base text-black z-50 font-bold bg-white/90 px-3 py-1 rounded shadow">
        v{APP_VERSION}
      </div>
      <h1 className="text-6xl font-bold mb-6 text-[#667eea]">Most Likely To</h1>
      <p className="text-xl text-gray-400 mb-12">A multiplayer party game</p>
      
      {!showJoinForm && !showCreateForm ? (
        <div className="flex gap-6 flex-wrap justify-center">
          <button className="text-xl font-semibold py-4 px-10 rounded-lg border-none cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-lg min-w-[200px] bg-[#667eea] text-white" onClick={() => setShowCreateForm(true)}>Create Room</button>
          <button className="text-xl font-semibold py-4 px-10 rounded-lg border-none cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-lg min-w-[200px] bg-[#ff6b6b] text-white" onClick={() => setShowJoinForm(true)}>Join Room</button>
        </div>
      ) : showCreateForm ? (
        <form className="flex flex-col items-center gap-4" onSubmit={(e) => { e.preventDefault(); handleCreateRoom(); }}>
          <input
            type="text"
            placeholder="Your Nickname"
            value={hostNickname}
            onChange={(e) => setHostNickname(e.target.value)}
            className="w-full max-w-md px-4 py-3 rounded-lg border border-gray-600 bg-[#1a1a2e] text-white focus:outline-none focus:ring-2 focus:ring-[#667eea]"
          />
          {error && <p className="text-[#ff6b6b]">{error}</p>}
          <div className="flex gap-4">
            <button type="submit" className="text-xl font-semibold py-4 px-10 rounded-lg border-none cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-lg min-w-[200px] bg-[#667eea] text-white">Create</button>
            <button type="button" className="text-xl font-semibold py-4 px-10 rounded-lg border-none cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-lg min-w-[200px] bg-[#ff6b6b] text-white" onClick={() => { setShowCreateForm(false); setError(''); }}>Cancel</button>
          </div>
        </form>
      ) : (
        <form className="flex flex-col items-center gap-4" onSubmit={handleJoinRoom}>
          <h2 className="text-2xl font-medium text-white mb-2">Join Room</h2>
          <input
            type="text"
            placeholder="Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            className="w-full max-w-md px-4 py-3 rounded-lg border border-gray-600 bg-[#1a1a2e] text-white focus:outline-none focus:ring-2 focus:ring-[#667eea]"
            maxLength={4}
          />
          <input
            type="text"
            placeholder="Your Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full max-w-md px-4 py-3 rounded-lg border border-gray-600 bg-[#1a1a2e] text-white focus:outline-none focus:ring-2 focus:ring-[#667eea]"
          />
          {error && <p className="text-[#ff6b6b]">{error}</p>}
          <div className="flex gap-4">
            <button type="submit" className="text-xl font-semibold py-4 px-10 rounded-lg border-none cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-lg min-w-[200px] bg-[#667eea] text-white">Join</button>
            <button type="button" className="text-xl font-semibold py-4 px-10 rounded-lg border-none cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-lg min-w-[200px] bg-[#ff6b6b] text-white" onClick={() => { setShowJoinForm(false); setError(''); }}>Cancel</button>
          </div>
        </form>
      )}
      
      <button 
        className="fixed bottom-2.5 left-2.5 opacity-30 text-xs text-gray-600 z-50 bg-none border-none cursor-pointer"
        onClick={handleDevClick}
      >
        DEV
      </button>
      
      {showDevModal && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1a1a1a] p-8 rounded-lg z-[10001] min-w-[400px] max-h-[80vh] overflow-auto">
          <h2 className="text-white mb-4">Dev Tools</h2>
          <h3 className="text-gray-400 mb-2">Active Rooms ({activeRooms.length})</h3>
          <div className="mb-4 max-h-[200px] overflow-auto">
            {activeRooms.length === 0 ? (
              <p className="text-gray-600">No active rooms</p>
            ) : (
              <ul className="text-gray-400 list-none p-0">
                {activeRooms.map(room => (
                  <li key={room.code} className="mb-2 p-2 bg-[#2a2a2a] rounded">
                    <strong>Code:</strong> {room.code} | <strong>Status:</strong> {room.status}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button 
            className="text-xl font-semibold py-4 px-10 rounded-lg border-none cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-lg min-w-[200px] bg-[#ff4444] text-white mr-2"
            onClick={killAllRooms}
          >
            Kill All Rooms
          </button>
          <button 
            className="text-xl font-semibold py-4 px-10 rounded-lg border-none cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-lg min-w-[200px] bg-[#ff6b6b] text-white"
            onClick={() => setShowDevModal(false)}
          >
            Close
          </button>
        </div>
      )}
      
      {showDevModal && (
        <div 
          className="fixed top-0 left-0 right-0 bottom-0 bg-black/70 z-[10000]"
          onClick={() => setShowDevModal(false)}
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

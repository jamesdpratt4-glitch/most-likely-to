import { useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { assignRandomEmoji } from './lib/emojis'
import HostLobby from './pages/HostLobby'
import PlayerLobby from './pages/PlayerLobby'
import Game from './pages/Game'
import GameOver from './pages/GameOver'
import JoinRoom from './pages/JoinRoom'

const APP_VERSION = "1.0.96"

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-5">
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 font-semibold text-zinc-500 bg-zinc-900/70 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-800">
        v{APP_VERSION}
      </div>
      <div className="container mx-auto px-4 max-w-2xl text-center">
        <h1 className="text-6xl font-bold mb-4 text-white tracking-tight">Most Likely To</h1>
        <p className="text-xl text-slate-300 mb-12">A multiplayer party game</p>
      
        {!showJoinForm && !showCreateForm ? (
          <div className="flex gap-4 flex-wrap justify-center">
            <button 
              className="text-lg font-semibold py-4 px-8 rounded-xl border-none cursor-pointer transition-all duration-300 ease-in-out hover:bg-indigo-600 active:scale-95 min-w-[200px] bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
              onClick={() => setShowCreateForm(true)}
            >
              Create Room
            </button>
            <button 
              className="text-lg font-semibold py-4 px-8 rounded-xl border-none cursor-pointer transition-all duration-300 ease-in-out hover:bg-indigo-600 active:scale-95 min-w-[200px] bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
              onClick={() => setShowJoinForm(true)}
            >
              Join Room
            </button>
          </div>
        ) : showCreateForm ? (
          <form className="flex flex-col items-center gap-6 w-full max-w-md mx-auto" onSubmit={(e) => { e.preventDefault(); handleCreateRoom(); }}>
            <div className="w-full">
              <input
                type="text"
                placeholder="Your Nickname"
                value={hostNickname}
                onChange={(e) => setHostNickname(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-zinc-900/50 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300 ease-in-out"
              />
            </div>
            {error && <p className="text-red-400 font-medium">{error}</p>}
            <div className="flex gap-4 w-full">
              <button type="submit" className="flex-1 text-lg font-semibold py-4 px-8 rounded-xl border-none cursor-pointer transition-all duration-300 ease-in-out hover:bg-indigo-600 active:scale-95 bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">Create</button>
              <button type="button" className="flex-1 text-lg font-semibold py-4 px-8 rounded-xl border-none cursor-pointer transition-all duration-300 ease-in-out hover:bg-slate-700 active:scale-95 bg-slate-600 text-white" onClick={() => { setShowCreateForm(false); setError(''); }}>Cancel</button>
            </div>
          </form>
        ) : (
          <form className="flex flex-col items-center gap-6 w-full max-w-md mx-auto" onSubmit={handleJoinRoom}>
            <h2 className="text-2xl font-semibold text-white mb-2">Join Room</h2>
            <div className="w-full">
              <input
                type="text"
                placeholder="Room Code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-zinc-900/50 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300 ease-in-out"
                maxLength={4}
              />
            </div>
            <div className="w-full">
              <input
                type="text"
                placeholder="Your Nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-zinc-900/50 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300 ease-in-out"
              />
            </div>
            {error && <p className="text-red-400 font-medium">{error}</p>}
            <div className="flex gap-4 w-full">
              <button type="submit" className="flex-1 text-lg font-semibold py-4 px-8 rounded-xl border-none cursor-pointer transition-all duration-300 ease-in-out hover:bg-indigo-600 active:scale-95 bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">Join</button>
              <button type="button" className="flex-1 text-lg font-semibold py-4 px-8 rounded-xl border-none cursor-pointer transition-all duration-300 ease-in-out hover:bg-slate-700 active:scale-95 bg-slate-600 text-white" onClick={() => { setShowJoinForm(false); setError(''); }}>Cancel</button>
            </div>
          </form>
        )}
      </div>
      
      <button 
        className="fixed bottom-4 left-4 opacity-40 text-xs text-zinc-500 z-50 bg-none border-none cursor-pointer hover:opacity-60 transition-all duration-300 ease-in-out"
        onClick={handleDevClick}
      >
        DEV
      </button>
      
      {showDevModal && (
        <>
          <div 
            className="fixed top-0 left-0 right-0 bottom-0 bg-black/60 backdrop-blur-sm z-[10000]"
            onClick={() => setShowDevModal(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900/90 backdrop-blur-md p-8 rounded-2xl z-[10001] min-w-[400px] max-h-[80vh] overflow-auto border border-slate-800 shadow-2xl">
            <h2 className="text-white mb-4 text-xl font-semibold">Dev Tools</h2>
            <h3 className="text-slate-400 mb-2">Active Rooms ({activeRooms.length})</h3>
            <div className="mb-6 max-h-[200px] overflow-auto">
              {activeRooms.length === 0 ? (
                <p className="text-zinc-500">No active rooms</p>
              ) : (
                <ul className="text-slate-400 list-none p-0 space-y-2">
                  {activeRooms.map(room => (
                    <li key={room.code} className="p-3 bg-zinc-800/50 rounded-xl border border-slate-800">
                      <span className="font-medium text-white">Code:</span> {room.code} | <span className="font-medium text-white">Status:</span> {room.status}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-4">
              <button 
                className="flex-1 text-lg font-semibold py-4 px-8 rounded-xl border-none cursor-pointer transition-all duration-300 ease-in-out hover:bg-red-500 active:scale-95 bg-red-600 text-white"
                onClick={killAllRooms}
              >
                Kill All Rooms
              </button>
              <button 
                className="flex-1 text-lg font-semibold py-4 px-8 rounded-xl border-none cursor-pointer transition-all duration-300 ease-in-out hover:bg-slate-700 active:scale-95 bg-slate-600 text-white"
                onClick={() => setShowDevModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </>
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

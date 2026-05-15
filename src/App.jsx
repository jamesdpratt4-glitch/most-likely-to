import { useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import HostLobby from './pages/HostLobby'
import './App.css'

function Home() {
  const navigate = useNavigate()

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

  return (
    <div className="app">
      <h1 className="title">Most Likely To</h1>
      <p className="subtitle">A multiplayer party game</p>
      <div className="buttons">
        <button className="btn btn-primary" onClick={handleCreateRoom}>Create Room</button>
        <button className="btn btn-secondary">Join Room</button>
      </div>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/host/:code" element={<HostLobby />} />
    </Routes>
  )
}

export default App

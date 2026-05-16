import { useNavigate } from 'react-router-dom'

function GameOver() {
  const navigate = useNavigate()

  const handleReturnHome = () => {
    localStorage.removeItem('nickname')
    localStorage.removeItem('roomCode')
    localStorage.removeItem('isHost')
    navigate('/')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-5">
      <div className="container mx-auto px-4 max-w-2xl text-center">
        <h1 className="text-6xl font-bold mb-4 text-white tracking-tight">Game Over</h1>
        <p className="text-xl text-slate-300 mb-8">The host has ended the game.</p>
        <button 
          onClick={handleReturnHome} 
          className="text-lg font-semibold py-4 px-8 rounded-xl border-none cursor-pointer transition-all duration-300 ease-in-out hover:bg-indigo-600 active:scale-95 min-w-[200px] bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
        >
          Return Home
        </button>
      </div>
    </div>
  )
}

export default GameOver

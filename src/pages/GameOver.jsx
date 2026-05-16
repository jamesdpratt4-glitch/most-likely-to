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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f0f] text-white p-5">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4 text-[#667eea]">Game Over</h1>
        <p className="text-xl text-gray-400 mb-8">The host has ended the game.</p>
        <button onClick={handleReturnHome} className="text-xl font-semibold py-4 px-10 rounded-lg border-none cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-lg min-w-[200px] bg-[#667eea] text-white">
          Return Home
        </button>
      </div>
    </div>
  )
}

export default GameOver

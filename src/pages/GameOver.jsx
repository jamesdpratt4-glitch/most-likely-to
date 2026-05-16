import { useNavigate } from 'react-router-dom'
import './Game.css'

function GameOver() {
  const navigate = useNavigate()

  const handleReturnHome = () => {
    localStorage.removeItem('nickname')
    localStorage.removeItem('roomCode')
    localStorage.removeItem('isHost')
    navigate('/')
  }

  return (
    <div className="game game-over">
      <div className="game-over-content">
        <h1 className="game-over-title">Game Over</h1>
        <p className="game-over-message">The host has ended the game.</p>
        <button onClick={handleReturnHome} className="btn btn-primary">
          Return Home
        </button>
      </div>
    </div>
  )
}

export default GameOver

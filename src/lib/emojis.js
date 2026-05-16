const ANIMAL_EMOJIS = [
  '🐶', '🐱', '🐭', '🐹', '🐰',
  '🦊', '🐻', '🐼', '🐨', '🐯',
  '🦁', '🐮', '🐷', '🐸', '🐵',
  '🐔', '🐧', '🐦', '🦆', '🦉',
  '🐺', '🐗', '🦄', '🐝', '🐞'
]

/**
 * Assign a random emoji to a player, ensuring no duplicates in the room
 * @param {string} roomCode - The room code
 * @param {Array} existingEmojis - Array of emojis already assigned in the room
 * @returns {string} - The assigned emoji
 */
export const assignRandomEmoji = (existingEmojis = []) => {
  const availableEmojis = ANIMAL_EMOJIS.filter(emoji => !existingEmojis.includes(emoji))
  
  if (availableEmojis.length === 0) {
    // If all emojis are used, return a random one (fallback for large rooms)
    return ANIMAL_EMOJIS[Math.floor(Math.random() * ANIMAL_EMOJIS.length)]
  }
  
  return availableEmojis[Math.floor(Math.random() * availableEmojis.length)]
}

export default ANIMAL_EMOJIS

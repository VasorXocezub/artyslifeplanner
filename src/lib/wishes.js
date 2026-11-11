export const TONES = [
  { key: 'cheeky', label: '😜 Cheeky' },
  { key: 'sweet', label: '🥰 Sweet' },
  { key: 'formal', label: '🎩 Formal' },
]

const WISHES = {
  cheeky: [
    'Happy birthday {name}! 🎉 Another year older, still not wiser. Love you anyway.',
    '{name}!! 🎂 Officially one year closer to free parking and early nights. Happy birthday!',
    'Happy birthday {name}! 🥂 You don’t look a day over fabulous.',
    'It’s your day {name}! 🎈 Eat the cake, ignore the calories, and drinks are on you (kidding... mostly).',
  ],
  sweet: [
    'Happy birthday {name}! 💖 So grateful to have you in my life. I hope your day is full of love and cake.',
    'Happy birthday, beautiful {name}! 🌸 Wishing you a year of joy, laughter and everything you dream of.',
    'Thinking of you today {name} 🎂 You make the world brighter. Happy birthday!',
    'Happy birthday {name}! 🥰 Sending you all my love today and always.',
  ],
  formal: [
    'Happy birthday, {name}. Wishing you a wonderful day and a successful year ahead.',
    'Warmest birthday wishes, {name}. I hope the year ahead brings you health, happiness and success.',
    'Many happy returns, {name}. I hope you have a lovely day.',
  ],
}

export function wishFor(tone, name, index = 0) {
  const list = WISHES[tone] || WISHES.sweet
  return list[index % list.length].replaceAll('{name}', (name || '').split(' ')[0] || 'you')
}
export function wishCount(tone) { return (WISHES[tone] || WISHES.sweet).length }

export function smsHref(phone, body) {
  return `sms:${phone}?&body=${encodeURIComponent(body)}`
}

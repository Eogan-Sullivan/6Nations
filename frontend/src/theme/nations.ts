export const nationColors = {
  light: { Ireland: '#087F50', France: '#214BB8', England: '#5B2633', Scotland: '#172B4D', Wales: '#B32638', Italy: '#126DB5' },
  dark: { Ireland: '#7EE2A4', France: '#9BAFFF', England: '#F1F5E9', Scotland: '#B8A5F4', Wales: '#FFACA6', Italy: '#8AD9ED' },
  jersey: {
    Ireland: { fabric: '#087F50', trim: '#E8EEDC', number: '#FFFFFF' },
    England: { fabric: '#F2F3ED', trim: '#B92335', number: '#142536' },
    France: { fabric: '#214BB8', trim: '#D94750', number: '#FFFFFF' },
    Scotland: { fabric: '#172B4D', trim: '#E8EEDC', number: '#FFFFFF' },
    Wales: { fabric: '#B32638', trim: '#F4F2EC', number: '#FFFFFF' },
    Italy: { fabric: '#126DB5', trim: '#F4F2EC', number: '#FFFFFF' },
  },
} as const;

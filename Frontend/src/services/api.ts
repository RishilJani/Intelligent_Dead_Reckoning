import axios from 'axios';
import { Platform } from 'react-native';

// Base URL for backend server running on port 5000.
// On Android emulator, '10.0.2.2' routes to computer's localhost.
// On Web or iOS simulator, 'localhost' or '127.0.0.1' is used.
export const BASE_URL = Platform.OS === 'android' ? 'https://intelligent-dead-reckoning-nu4j.onrender.com' : 'https://intelligent-dead-reckoning-nu4j.onrender.com';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export default api;

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from './app/HomePage'
import { MapPage } from './app/MapPage'

export default function App() {
  return <BrowserRouter><Routes><Route path="/" element={<HomePage />} /><Route path="/builder" element={<MapPage />} /><Route path="/builder/:id" element={<MapPage />} /><Route path="/map/:id" element={<MapPage presentation />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></BrowserRouter>
}

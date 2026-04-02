import { Route, Routes } from "react-router-dom";

import LibraryWindow from "@/windows/LibraryWindow";
import ReaderWindow from "@/windows/ReaderWindow";
import SettingsWindow from "@/windows/SettingsWindow";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LibraryWindow />} />
      <Route path="/reader" element={<ReaderWindow />} />
      <Route path="/settings" element={<SettingsWindow />} />
    </Routes>
  );
}

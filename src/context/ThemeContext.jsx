import React, { createContext, useContext } from 'react';

const ThemeContext = createContext({ darkMode: false });

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ darkMode, children }) => (
  <ThemeContext.Provider value={{ darkMode }}>{children}</ThemeContext.Provider>
);

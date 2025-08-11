@echo off
echo Starting HospedeFacil Development Servers...
echo.

start "Backend Server" cmd /k "cd backend && npm run dev"
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo Both servers are starting in separate windows!
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000
echo.
pause
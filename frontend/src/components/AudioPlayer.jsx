import { useState, useRef, useEffect } from 'react';
import { Box, IconButton, Slider, Typography } from '@mui/material';
import { PlayArrow, Pause, Stop } from '@mui/icons-material';

function AudioPlayer({ src }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      if (!isSeeking) {
        setCurrentTime(audio.currentTime);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [isSeeking]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    const audio = audioRef.current;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSliderChange = (event, newValue) => {
    setCurrentTime(newValue);
  };

  const handleSliderChangeCommitted = (event, newValue) => {
    const audio = audioRef.current;
    audio.currentTime = newValue;
    setIsSeeking(false);
  };

  const handleSliderMouseDown = () => {
    setIsSeeking(true);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ width: '100%' }}>
      <audio ref={audioRef} src={src} preload="none" />
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Play/Pause Button */}
        <IconButton
          onClick={handlePlayPause}
          color="primary"
          size="large"
          sx={{ 
            bgcolor: 'primary.main',
            color: 'white',
            '&:hover': {
              bgcolor: 'primary.dark'
            }
          }}
        >
          {isPlaying ? <Pause /> : <PlayArrow />}
        </IconButton>

        {/* Stop Button */}
        <IconButton
          onClick={handleStop}
          size="large"
          sx={{ 
            bgcolor: 'grey.300',
            color: 'grey.700',
            '&:hover': {
              bgcolor: 'grey.400'
            }
          }}
        >
          <Stop />
        </IconButton>

        {/* Time Display */}
        <Typography variant="caption" sx={{ minWidth: 45, textAlign: 'right' }}>
          {formatTime(currentTime)}
        </Typography>

        {/* Progress Slider */}
        <Slider
          value={currentTime}
          max={duration || 100}
          onChange={handleSliderChange}
          onChangeCommitted={handleSliderChangeCommitted}
          onMouseDown={handleSliderMouseDown}
          onTouchStart={handleSliderMouseDown}
          sx={{ flexGrow: 1, mx: 2 }}
          size="small"
        />

        {/* Duration Display */}
        <Typography variant="caption" sx={{ minWidth: 45 }}>
          {formatTime(duration)}
        </Typography>
      </Box>
    </Box>
  );
}

export default AudioPlayer;

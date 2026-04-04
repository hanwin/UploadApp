import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/sv';

dayjs.locale('sv');

function ScheduleDialog({ open, onClose, onSchedule, currentSchedule }) {
  const [selectedDate, setSelectedDate] = useState(
    currentSchedule ? dayjs(currentSchedule) : null
  );

  const handleSchedule = () => {
    if (selectedDate) {
      onSchedule(selectedDate.toISOString());
    }
    onClose();
  };

  const handleClear = () => {
    onSchedule(null);
    onClose();
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="sv">
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Schemalägg sändning</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <DateTimePicker
              label="Datum och tid"
              value={selectedDate}
              onChange={(newValue) => setSelectedDate(newValue)}
              ampm={false}
              format="YYYY-MM-DD HH:mm"
              slotProps={{
                textField: {
                  fullWidth: true,
                  helperText: 'Välj när filen ska sändas'
                }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          {currentSchedule && (
            <Button onClick={handleClear} color="warning">
              Ta bort schema
            </Button>
          )}
          <Button onClick={onClose}>
            Avbryt
          </Button>
          <Button 
            onClick={handleSchedule} 
            variant="contained"
            disabled={!selectedDate}
          >
            Spara
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
}

export default ScheduleDialog;

import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Chip, Divider, Stack
} from '@mui/material';
import { NewReleases, BugReport, TrendingUp } from '@mui/icons-material';
import { CHANGELOG } from '../version';

const TYPE_CONFIG = {
  new:     { label: 'Nytt',       color: 'success', Icon: NewReleases },
  fix:     { label: 'Buggfix',    color: 'error',   Icon: BugReport },
  improve: { label: 'Förbättring',color: 'info',    Icon: TrendingUp },
};

export default function VersionDialog({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle sx={{ pb: 1 }}>
        Versionshistorik
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {CHANGELOG.map((release, idx) => (
          <Box key={release.version}>
            <Box sx={{ px: 3, py: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1.5} mb={1.5}>
                <Typography variant="subtitle1" fontWeight="bold">
                  v{release.version}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {release.date}
                </Typography>
                {idx === 0 && (
                  <Chip label="Senaste" size="small" color="primary" />
                )}
              </Stack>
              <Stack spacing={1}>
                {release.entries.map((entry, i) => {
                  const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.new;
                  const { Icon } = cfg;
                  return (
                    <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                      <Chip
                        icon={<Icon sx={{ fontSize: '0.85rem !important' }} />}
                        label={cfg.label}
                        color={cfg.color}
                        size="small"
                        sx={{ minWidth: 100, flexShrink: 0, mt: '1px' }}
                      />
                      <Typography variant="body2" sx={{ pt: '3px' }}>
                        {entry.text}
                      </Typography>
                    </Stack>
                  );
                })}
              </Stack>
            </Box>
            {idx < CHANGELOG.length - 1 && <Divider />}
          </Box>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Stäng</Button>
      </DialogActions>
    </Dialog>
  );
}

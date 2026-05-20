import { Box, Typography } from '@mui/material';

export default function KanbanPage() {
  return (
    <Box sx={{ py: 4 }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
        Kanban Board
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Use the main dashboard for the full experience.
      </Typography>
    </Box>
  );
}

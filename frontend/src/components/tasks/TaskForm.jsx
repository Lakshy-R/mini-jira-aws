import { useState } from 'react';
import {
    Button,
    MenuItem,
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material';

export default function TaskForm({ onTaskCreated }) {
    const [form, setForm] = useState({
        title: '',
        description: '',
        priority: 'MEDIUM',
        deadline: '',
        teamId: '',
        assigneeId: '',
        projectId: '',
    });
    const [imageFile, setImageFile] = useState(null);

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    };

    const handleImageChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setImageFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        await onTaskCreated(form, imageFile);

        setForm({
            title: '',
            description: '',
            priority: 'MEDIUM',
            deadline: '',
            teamId: '',
            assigneeId: '',
            projectId: '',
        });
        setImageFile(null);
    };

    return (
        <Paper component="form" onSubmit={handleSubmit} sx={{ p: 3 }} elevation={2}>
            <Stack spacing={2}>
                <Typography variant="h6" fontWeight={700}>
                    Create Task
                </Typography>

                <TextField
                    name="title"
                    label="Task title"
                    value={form.title}
                    onChange={handleChange}
                    fullWidth
                    size="small"
                />

                <TextField
                    name="description"
                    label="Description"
                    value={form.description}
                    onChange={handleChange}
                    fullWidth
                    size="small"
                    multiline
                    rows={3}
                />

                <TextField
                    name="priority"
                    label="Priority"
                    value={form.priority}
                    onChange={handleChange}
                    fullWidth
                    size="small"
                    select
                >
                    <MenuItem value="LOW">LOW</MenuItem>
                    <MenuItem value="MEDIUM">MEDIUM</MenuItem>
                    <MenuItem value="HIGH">HIGH</MenuItem>
                </TextField>

                <TextField
                    name="deadline"
                    label="Deadline"
                    type="date"
                    value={form.deadline}
                    onChange={handleChange}
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true }}
                />

                <TextField
                    name="teamId"
                    label="Team ID"
                    value={form.teamId}
                    onChange={handleChange}
                    fullWidth
                    size="small"
                />

                <TextField
                    name="assigneeId"
                    label="Assignee ID"
                    value={form.assigneeId}
                    onChange={handleChange}
                    fullWidth
                    size="small"
                />

                <TextField
                    name="projectId"
                    label="Project ID"
                    value={form.projectId}
                    onChange={handleChange}
                    fullWidth
                    size="small"
                />

                <Button component="label" variant="outlined">
                    Upload image
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        hidden
                    />
                </Button>

                <Button type="submit" variant="contained">
                    Create Task
                </Button>
            </Stack>
        </Paper>
    );
}

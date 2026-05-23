require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.use(cors());
app.use(express.json());

/*
=====================================
ROOT
=====================================
*/
app.get("/", (req, res) => {
  res.send("Task Management API Running");
});

/*
=====================================
DASHBOARD
=====================================
*/
app.get("/api/dashboard", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("*");

    if (error) throw error;

    const totalTasks = data.length;

    const pending = data.filter(
      task => task.status === "Pending"
    ).length;

    const inProgress = data.filter(
      task => task.status === "In Progress"
    ).length;

    const completed = data.filter(
      task => task.status === "Completed"
    ).length;

    const overdue = data.filter(task => {
      if (!task.deadline) return false;

      return (
        new Date(task.deadline) < new Date() &&
        task.status !== "Completed"
      );
    }).length;

    const upcomingDeadlines = data
      .filter(task => task.deadline)
      .sort(
        (a, b) =>
          new Date(a.deadline) -
          new Date(b.deadline)
      )
      .slice(0, 5);

    res.json({
      totalTasks,
      pending,
      inProgress,
      completed,
      overdue,
      upcomingDeadlines
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

/*
=====================================
RECENT ACTIVITY
=====================================
*/
app.get("/api/activity", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", {
        ascending: false
      })
      .limit(10);

    if (error) throw error;

    const activity = data.map(task => ({
      message: `${task.assignedTo} updated "${task.title}"`,
      created_at: task.created_at
    }));

    res.json(activity);

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

/*
=====================================
GET ALL TASKS
=====================================
*/
app.get("/api/tasks", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", {
        ascending: false
      });

    if (error) throw error;

    res.json(data);

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

/*
=====================================
GET SINGLE TASK
=====================================
*/
app.get("/api/tasks/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        message: "Task not found"
      });
    }

    res.json(data);

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

/*
=====================================
CREATE TASK
=====================================
*/
app.post("/api/tasks", async (req, res) => {
  try {
    const {
      title,
      assignedTo,
      deadline,
      status,
      remarks
    } = req.body;

    if (!title) {
      return res.status(400).json({
        message: "Task title is required"
      });
    }

    const newTask = {
      title,
      assignedTo: assignedTo || "Unassigned",
      deadline: deadline || null,
      status: status || "Pending",
      remarks: remarks || "",
      subtasks: [],
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("tasks")
      .insert([newTask])
      .select();

    if (error) throw error;

    res.json({
      message: "Task created successfully",
      task: data[0]
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

/*
=====================================
UPDATE TASK
=====================================
*/
app.put("/api/tasks/:id", async (req, res) => {
  try {
    const updateData = {};

    const fields = [
      "title",
      "assignedTo",
      "deadline",
      "status",
      "remarks"
    ];

    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const { data, error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", req.params.id)
      .select();

    if (error) throw error;

    res.json({
      message: "Task updated successfully",
      task: data[0]
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

/*
=====================================
DELETE TASK
=====================================
*/
app.delete("/api/tasks/:id", async (req, res) => {
  try {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;

    res.json({
      message: "Task deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

/*
=====================================
UPDATE TASK STATUS
=====================================
*/
app.patch("/api/tasks/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    const { data, error } = await supabase
      .from("tasks")
      .update({ status })
      .eq("id", req.params.id)
      .select();

    if (error) throw error;

    res.json({
      message: "Status updated successfully",
      task: data[0]
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

/*
=====================================
ADD SUBTASK
=====================================
*/
app.post("/api/tasks/:id/subtasks", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        message: "Task not found"
      });
    }

    const subtasks = data.subtasks || [];

    const newSubtask = {
      id:
        subtasks.length > 0
          ? subtasks[subtasks.length - 1].id + 1
          : 1,

      title: req.body.title,
      assignedTo:
        req.body.assignedTo || "Unassigned",
      deadline:
        req.body.deadline || null,
      status:
        req.body.status || "Pending",
      remarks:
        req.body.remarks || "",
      created_at:
        new Date().toISOString()
    };

    subtasks.push(newSubtask);

    const { error: updateError } =
      await supabase
        .from("tasks")
        .update({ subtasks })
        .eq("id", req.params.id);

    if (updateError) throw updateError;

    res.json({
      message: "Subtask added successfully",
      subtask: newSubtask
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

/*
=====================================
UPDATE SUBTASK
=====================================
*/
app.put("/api/tasks/:taskId/subtasks/:subId", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", req.params.taskId)
      .single();

    if (error || !data) {
      return res.status(404).json({
        message: "Task not found"
      });
    }

    const subtasks = data.subtasks || [];

    const subtask = subtasks.find(
      sub => sub.id === Number(req.params.subId)
    );

    if (!subtask) {
      return res.status(404).json({
        message: "Subtask not found"
      });
    }

    const fields = [
      "title",
      "assignedTo",
      "deadline",
      "status",
      "remarks"
    ];

    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        subtask[field] = req.body[field];
      }
    });

    const { error: updateError } =
      await supabase
        .from("tasks")
        .update({ subtasks })
        .eq("id", req.params.taskId);

    if (updateError) throw updateError;

    res.json({
      message: "Subtask updated successfully",
      subtask
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

/*
=====================================
DELETE SUBTASK
=====================================
*/
app.delete("/api/tasks/:taskId/subtasks/:subId", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", req.params.taskId)
      .single();

    if (error || !data) {
      return res.status(404).json({
        message: "Task not found"
      });
    }

    const subtasks = data.subtasks || [];

    const updatedSubtasks = subtasks.filter(
      sub => sub.id !== Number(req.params.subId)
    );

    const { error: updateError } =
      await supabase
        .from("tasks")
        .update({
          subtasks: updatedSubtasks
        })
        .eq("id", req.params.taskId);

    if (updateError) throw updateError;

    res.json({
      message: "Subtask deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

/*
=====================================
SERVER
=====================================
*/
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
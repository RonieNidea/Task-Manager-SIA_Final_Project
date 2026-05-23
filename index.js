require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();

// ✅ Validate required env variables on startup
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_KEY environment variables.");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ✅ CORS must come before routes
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/*
=====================================
ROOT
=====================================
*/
app.get("/", (req, res) => {
  res.json({ message: "Task Management API Running", status: "ok" });
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

    const now = new Date();

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
      return new Date(task.deadline) < now && task.status !== "Completed";
    }).length;

    // ✅ Only include non-completed tasks with future or current deadlines
    const upcomingDeadlines = data
      .filter(task => task.deadline && task.status !== "Completed")
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
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
    console.error("Dashboard error:", error.message);
    res.status(500).json({ message: error.message });
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
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    // ✅ Handle null/missing assignedTo gracefully
    const activity = data.map(task => ({
      message: `"${task.title}" was assigned to ${task.assignedTo || "Unassigned"}`,
      created_at: task.created_at
    }));

    res.json(activity);

  } catch (error) {
    console.error("Activity error:", error.message);
    res.status(500).json({ message: error.message });
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
      .order("created_at", { ascending: false });

    if (error) throw error;

    // ✅ Ensure subtasks is always an array, never null
    const tasks = data.map(task => ({
      ...task,
      subtasks: Array.isArray(task.subtasks) ? task.subtasks : []
    }));

    res.json(tasks);

  } catch (error) {
    console.error("Get tasks error:", error.message);
    res.status(500).json({ message: error.message });
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
      return res.status(404).json({ message: "Task not found" });
    }

    // ✅ Ensure subtasks is always an array
    res.json({
      ...data,
      subtasks: Array.isArray(data.subtasks) ? data.subtasks : []
    });

  } catch (error) {
    console.error("Get task error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

/*
=====================================
CREATE TASK
=====================================
*/
app.post("/api/tasks", async (req, res) => {
  try {
    const { title, assignedTo, deadline, status, remarks } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Task title is required" });
    }

    // ✅ Validate status value
    const validStatuses = ["Pending", "In Progress", "Completed"];
    const taskStatus = validStatuses.includes(status) ? status : "Pending";

    const newTask = {
      title: title.trim(),
      assignedTo: assignedTo?.trim() || "Unassigned",
      deadline: deadline || null,
      status: taskStatus,
      remarks: remarks?.trim() || "",
      subtasks: [],
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("tasks")
      .insert([newTask])
      .select();

    if (error) throw error;

    res.status(201).json({
      message: "Task created successfully",
      task: data[0]
    });

  } catch (error) {
    console.error("Create task error:", error.message);
    res.status(500).json({ message: error.message });
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

    const fields = ["title", "assignedTo", "deadline", "status", "remarks"];
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // ✅ Validate status if provided
    const validStatuses = ["Pending", "In Progress", "Completed"];
    if (updateData.status && !validStatuses.includes(updateData.status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No fields provided to update" });
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", req.params.id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json({
      message: "Task updated successfully",
      task: data[0]
    });

  } catch (error) {
    console.error("Update task error:", error.message);
    res.status(500).json({ message: error.message });
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

    // ✅ Validate status value
    const validStatuses = ["Pending", "In Progress", "Completed"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      });
    }

    const { data, error } = await supabase
      .from("tasks")
      .update({ status })
      .eq("id", req.params.id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json({
      message: "Status updated successfully",
      task: data[0]
    });

  } catch (error) {
    console.error("Update status error:", error.message);
    res.status(500).json({ message: error.message });
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

    res.json({ message: "Task deleted successfully" });

  } catch (error) {
    console.error("Delete task error:", error.message);
    res.status(500).json({ message: error.message });
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
      return res.status(404).json({ message: "Task not found" });
    }

    if (!req.body.title || !req.body.title.trim()) {
      return res.status(400).json({ message: "Subtask title is required" });
    }

    const subtasks = Array.isArray(data.subtasks) ? data.subtasks : [];

    // ✅ Use Date.now() for unique IDs — avoids collisions after deletions
    const newSubtask = {
      id: Date.now(),
      title: req.body.title.trim(),
      assignedTo: req.body.assignedTo?.trim() || "Unassigned",
      deadline: req.body.deadline || null,
      status: req.body.status || "Pending",
      remarks: req.body.remarks?.trim() || "",
      created_at: new Date().toISOString()
    };

    subtasks.push(newSubtask);

    const { error: updateError } = await supabase
      .from("tasks")
      .update({ subtasks })
      .eq("id", req.params.id);

    if (updateError) throw updateError;

    res.status(201).json({
      message: "Subtask added successfully",
      subtask: newSubtask
    });

  } catch (error) {
    console.error("Add subtask error:", error.message);
    res.status(500).json({ message: error.message });
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
      return res.status(404).json({ message: "Task not found" });
    }

    const subtasks = Array.isArray(data.subtasks) ? data.subtasks : [];

    // ✅ subId from URL is a string; subtask.id may be number — compare both as strings
    const subtaskIndex = subtasks.findIndex(
      sub => String(sub.id) === String(req.params.subId)
    );

    if (subtaskIndex === -1) {
      return res.status(404).json({ message: "Subtask not found" });
    }

    const fields = ["title", "assignedTo", "deadline", "status", "remarks"];
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        subtasks[subtaskIndex][field] = req.body[field];
      }
    });

    const { error: updateError } = await supabase
      .from("tasks")
      .update({ subtasks })
      .eq("id", req.params.taskId);

    if (updateError) throw updateError;

    res.json({
      message: "Subtask updated successfully",
      subtask: subtasks[subtaskIndex]
    });

  } catch (error) {
    console.error("Update subtask error:", error.message);
    res.status(500).json({ message: error.message });
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
      return res.status(404).json({ message: "Task not found" });
    }

    const subtasks = Array.isArray(data.subtasks) ? data.subtasks : [];

    // ✅ Compare as strings to handle number/string ID mismatch
    const updatedSubtasks = subtasks.filter(
      sub => String(sub.id) !== String(req.params.subId)
    );

    if (updatedSubtasks.length === subtasks.length) {
      return res.status(404).json({ message: "Subtask not found" });
    }

    const { error: updateError } = await supabase
      .from("tasks")
      .update({ subtasks: updatedSubtasks })
      .eq("id", req.params.taskId);

    if (updateError) throw updateError;

    res.json({ message: "Subtask deleted successfully" });

  } catch (error) {
    console.error("Delete subtask error:", error.message);
    res.status(500).json({ message: error.message });
  }
});

/*
=====================================
404 HANDLER
=====================================
*/
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

/*
=====================================
SERVER
=====================================
*/
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const supabase = require("./supabase");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());



/*
=====================================================
ROOT ROUTE
=====================================================
*/
app.get("/", (req, res) => {
  res.send("WELCOME TO TASK MANAGEMENT API");
});



/*
=====================================================
DASHBOARD SUMMARY
=====================================================
*/
app.get("/api/dashboard", async (req, res) => {

  const { data, error } = await supabase
    .from("tasks")
    .select("*");

  if (error) {
    return res.status(500).json(error);
  }

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

});



/*
=====================================================
RECENT ACTIVITY
=====================================================
*/
app.get("/api/activity", async (req, res) => {

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", {
      ascending: false
    })
    .limit(10);

  if (error) {
    return res.status(500).json(error);
  }

  const activity = data.map(task => ({
    message:
      `${task.assignedTo} updated "${task.title}"`,
    created_at: task.created_at
  }));

  res.json(activity);

});



/*
=====================================================
GET ALL TASKS
=====================================================
*/
app.get("/api/tasks", async (req, res) => {

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", {
      ascending: false
    });

  if (error) {
    return res.status(500).json(error);
  }

  res.json(data);

});



/*
=====================================================
GET SINGLE TASK
=====================================================
*/
app.get("/api/tasks/:id", async (req, res) => {

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

});



/*
=====================================================
CREATE TASK
=====================================================
*/
app.post("/api/tasks", async (req, res) => {

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

  const { data, error } = await supabase
    .from("tasks")
    .insert([
      {
        title,
        assignedTo:
          assignedTo || "Unassigned",
        deadline: deadline || null,
        status: status || "Pending",
        remarks: remarks || "",
        subtasks: [],
        created_at: new Date()
      }
    ])
    .select();

  if (error) {
    return res.status(500).json(error);
  }

  res.json({
    message: "Task created successfully",
    task: data[0]
  });

});



/*
=====================================================
UPDATE TASK
=====================================================
*/
app.put("/api/tasks/:id", async (req, res) => {

  const {
    title,
    assignedTo,
    deadline,
    status,
    remarks
  } = req.body;

  const updateData = {
    title,
    assignedTo,
    deadline,
    status,
    remarks
  };

  const { data, error } = await supabase
    .from("tasks")
    .update(updateData)
    .eq("id", req.params.id)
    .select();

  if (error) {
    return res.status(500).json(error);
  }

  res.json({
    message: "Task updated successfully",
    task: data[0]
  });

});



/*
=====================================================
DELETE TASK
=====================================================
*/
app.delete("/api/tasks/:id", async (req, res) => {

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", req.params.id);

  if (error) {
    return res.status(500).json(error);
  }

  res.json({
    message: "Task deleted successfully"
  });

});



/*
=====================================================
UPDATE TASK STATUS ONLY
=====================================================
*/
app.patch("/api/tasks/:id/status", async (req, res) => {

  const { status } = req.body;

  const { data, error } = await supabase
    .from("tasks")
    .update({
      status
    })
    .eq("id", req.params.id)
    .select();

  if (error) {
    return res.status(500).json(error);
  }

  res.json({
    message: "Status updated successfully",
    task: data[0]
  });

});



/*
=====================================================
ADD SUBTASK
=====================================================
*/
app.post("/api/tasks/:id/subtasks", async (req, res) => {

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
    id: Date.now().toString(),
    title: req.body.title,
    assignedTo:
      req.body.assignedTo || "Unassigned",
    deadline:
      req.body.deadline || null,
    status:
      req.body.status || "Pending",
    remarks:
      req.body.remarks || "",
    created_at: new Date()
  };

  subtasks.push(newSubtask);

  const { error: updateError } = await supabase
    .from("tasks")
    .update({
      subtasks
    })
    .eq("id", req.params.id);

  if (updateError) {
    return res.status(500).json(updateError);
  }

  res.json({
    message: "Subtask added successfully",
    subtask: newSubtask
  });

});



/*
=====================================================
UPDATE SUBTASK
=====================================================
*/
app.put(
  "/api/tasks/:taskId/subtasks/:subId",
  async (req, res) => {

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
      sub =>
        sub.id === req.params.subId
    );

    if (!subtask) {

      return res.status(404).json({
        message: "Subtask not found"
      });

    }

    subtask.title =
      req.body.title ?? subtask.title;

    subtask.assignedTo =
      req.body.assignedTo ??
      subtask.assignedTo;

    subtask.deadline =
      req.body.deadline ??
      subtask.deadline;

    subtask.status =
      req.body.status ??
      subtask.status;

    subtask.remarks =
      req.body.remarks ??
      subtask.remarks;

    const { error: updateError } =
      await supabase
        .from("tasks")
        .update({
          subtasks
        })
        .eq("id", req.params.taskId);

    if (updateError) {
      return res.status(500).json(updateError);
    }

    res.json({
      message:
        "Subtask updated successfully",
      subtask
    });

  }
);



/*
=====================================================
DELETE SUBTASK
=====================================================
*/
app.delete(
  "/api/tasks/:taskId/subtasks/:subId",
  async (req, res) => {

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
      sub =>
        sub.id !== req.params.subId
    );

    const { error: updateError } =
      await supabase
        .from("tasks")
        .update({
          subtasks: updatedSubtasks
        })
        .eq("id", req.params.taskId);

    if (updateError) {
      return res.status(500).json(updateError);
    }

    res.json({
      message:
        "Subtask deleted successfully"
    });

  }
);



/*
=====================================================
SERVER
=====================================================
*/
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});
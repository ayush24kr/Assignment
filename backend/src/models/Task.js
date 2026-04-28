const mongoose = require('mongoose');

const logEntrySchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
    },
    message: {
      type: String,
      required: true,
    },
    level: {
      type: String,
      enum: ['info', 'warn', 'error'],
      default: 'info',
    },
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      minlength: [1, 'Title must be at least 1 character'],
      maxlength: [200, 'Title must be at most 200 characters'],
    },
    inputText: {
      type: String,
      required: [true, 'Input text is required'],
      maxlength: [10000, 'Input text must be at most 10000 characters'],
    },
    operation: {
      type: String,
      required: [true, 'Operation is required'],
      enum: {
        values: ['uppercase', 'lowercase', 'reverse', 'word_count'],
        message: 'Operation must be one of: uppercase, lowercase, reverse, word_count',
      },
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'success', 'failed'],
      default: 'pending',
    },
    result: {
      type: String,
      default: null,
    },
    logs: [logEntrySchema],
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for dashboard queries (user's tasks by status)
taskSchema.index({ userId: 1, status: 1 });

// Index for sorting by creation date
taskSchema.index({ createdAt: -1 });

// Compound index for user's tasks sorted by date
taskSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Task', taskSchema);

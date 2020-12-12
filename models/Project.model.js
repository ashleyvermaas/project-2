const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const projectSchema = new Schema(
{
  name: {
    type: String,
    required: [true, 'Name is required.']
  },
  date: {
    type: String,
    required: [true, 'Date is required.']
  },
  location: {
    type: String,
    required: [true, 'Location is required.']
  },
  description: {
    type: String,
    required: [true, 'Description is required.']
  }, 
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['Approve', 'Decline', 'Request', 'Pending'],
    default: 'Pending'
  },
  accountability: {
    type: String,
    required: [true, 'Accountability is required.']
  }
}, 
{
  timestamps: true
}
);

module.exports = model('Project', projectSchema);
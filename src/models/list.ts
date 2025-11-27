import mongoose, { Document, Schema } from 'mongoose';

// Interface for a single item within the list
export interface IListItem {
  itemId: string; // Unique ID for the item (UUID)
  text: string;
  completed: boolean;
  order: number; // Position/index for custom ordering
}

// Interface for the List Document
export interface IList extends Document {
  listId: string; // The short, unique ID (e.g., "KEEF78")
  name: string;
  owner: mongoose.Types.ObjectId; // Reference to the User model
  collaborators: mongoose.Types.ObjectId[]; // List of users with access
  items: IListItem[];
  archived: boolean;
  pinned: boolean;
  order: number; // Position/index for custom ordering of lists
  createdAt: Date;
  updatedAt: Date;
}

const ListItemSchema: Schema = new Schema({
  itemId: { type: String, required: true },
  text: { type: String, required: true },
  completed: { type: Boolean, default: false },
  order: { type: Number, required: true, default: 0 },
}, { _id: false }); // Prevent Mongoose from creating _id for subdocuments

const ListSchema: Schema = new Schema({
  listId: { type: String, required: true, unique: true },
  name: { type: String, required: true },

  // 🎯 CRITICAL FIX: Ensure 'owner' is a required ObjectId reference to 'User'
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User', // Links this field to the 'User' model
  },

  collaborators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: [],
  }],

  items: [ListItemSchema],

  archived: { type: Boolean, default: false },
  pinned: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
}, {
  timestamps: true,
  toJSON: { virtuals: true }, // Include virtuals when converting to JSON
  toObject: { virtuals: true } // Include virtuals when converting to Object
});

// The model instance
const List = mongoose.model<IList>('List', ListSchema);

export default List;
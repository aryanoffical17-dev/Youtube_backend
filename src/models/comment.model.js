import mongoose ,{Schema} from "mongoose"
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const CommentSchema = new Schema({
    content:{
        type:String,
        required:true,
        trim:true,
    },
    video:{
        type:Schema.Types.ObjectId,
        ref:"Video",
        required:true
    },
    owner:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    isDeleted:{ type:Boolean, default:false },
    editedAt:{ type:Date },
    deletedAt:{ type:Date },
},{timestamps:true})

CommentSchema.plugin(mongooseAggregatePaginate);
export const Comment = mongoose.model("Comment",CommentSchema)
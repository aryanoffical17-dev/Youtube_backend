import mongoose ,{Schema} from "mongoose"
const LikeSchema = new Schema({
    video:{
        type:Schema.Types.ObjectId,
        ref:"Video",
    },
    comment:{
        type:Schema.Types.ObjectId,
        ref:"Comment"
    },
    tweet:{
        type:Schema.Types.ObjectId,
        ref:"Tweet"
    },
    likedBy:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    }
}, { timestamps: true });

LikeSchema.index({ video: 1, likedBy: 1 }, { unique: true, partialFilterExpression: { video: { $exists: true } } });
LikeSchema.index({ comment: 1, likedBy: 1 }, { unique: true, partialFilterExpression: { comment: { $exists: true } } });
LikeSchema.index({ tweet: 1, likedBy: 1 }, { unique: true, partialFilterExpression: { tweet: { $exists: true } } });

export const Like = mongoose.model("Like", LikeSchema);
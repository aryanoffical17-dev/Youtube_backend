import mongoose ,{Schema} from "mongoose"

const PlaylistSchema = new Schema({
    name:{
        type:String,
        required:true,
        trim:true
    },
    description:{
        type:String,
        default:"",
        trim:true
    },
    videos:[{
        type:Schema.Types.ObjectId,
        ref:"Video"
    }],
    owner:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    }
},{timestamps:true})

export const Playlist = mongoose.model("Playlist" ,PlaylistSchema)
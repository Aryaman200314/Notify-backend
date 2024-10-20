require("dotenv").config();

const config =  require("./config.json");
const mongoose = require("mongoose");
mongoose.connect(process.env.MONGO_URI || config.connectionString);

const User = require("./models/user.model");
const Note = require("./models/note.model");

const express = require("express");
const cors = require("cors");
const app = express();

const jwt = require("jsonwebtoken");
const { authenticateToken} = require("./utilities");

app.use(express.json());

app.use(
    cors({
        origin: "*",
    })
);

app.get("/", (req, res) => {
    res.json({data: "hello world"});
});



app.post("/create-account", async (req, res) => {
    const {fullName, email, password} = req.body;
    if(!fullName){
        return res
        .status(400)
        .json({error: true, message: "Full Name is requried"});
    }

    if(!email){
        return res 
        .status(400)
        .json({error: true, message: "Email is requried"});
    }
    if(!password){
        return res
        .status(400)
        .json({error: true, message: "Password is requried"});
    }

    const isUser = await User.findOne({email: email});

    if(isUser){
        return res.json({
            error: true,
            message: "User already exists"
        });
    }

    const user = new User({
        fullName,
        email,
        password,
    });

    await user.save();
    const accessToken = jwt.sign({ user 
    }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "36000m",
    });

    return res.json({
        error: false,
        user,
        accessToken,
        message: "Registered Successfully", 
    });
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if(!email){
        return res
        .status(400)
        .json({error: true, message: "Email is requried"});
    }
    if(!password){
        return res 
        .status(400)
        .json({error: true, message: "Password is requried"});
    }
    const userInfo = await User.findOne({email: email});
    if(!userInfo) {
        return res
        .status(400)
        .json({message: "User not found"})
    }

    if(userInfo.email == email && userInfo.password == password) {
        const user = {user: userInfo};
        const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: "36000m",
        });

        return res.json({
            error: false,
            message: "Login Seccessfull",
            email,
            accessToken,
        });
    }
    else {
        return res.status(400).json({
            error:  true,
            message: "Invalid Credentials",
        })
    }
})


app.get("/get-user", authenticateToken ,async (req, res)=> {
    const { user } =  req.user;

    const isUser = await User.findOne({ _id: user._id });

    if(!isUser) {
        return res.sendStatus(401);
    }

    return res.json({
        user:  {fullName: isUser.fullName, email: isUser.email, "_id": isUser._id, createdOn: isUser.createdOn},
        message: "",
    });
})

// Add notes DATABASE

app.post("/add-notes", authenticateToken, async (req, res) => {
    const { title, content, tags } = req.body;
    const { user } = req.user;

    if(!title) {
        return res
        .status(400)
        .json({error: true, message: "Title is requried"});
    }

    if(!content) {
        return res
        .status(400)
        .json({error: true, message: "Content is requried"});
    }

    try {
        const note = new Note({
            title,
            content,
            tags: tags || [],
            userId: user._id,
        });

        await note.save();

        return res.json({

            error: false,
            note,
            message: "Note added successfully",
        });
    }
    catch (error){
        return res.status(500)
        .json({error: true, message: "Internal Server Error"});
    }
});


// Edit Notes DATABASE

app.put("/edit-notes/:noteId", authenticateToken, async (req, res) => {
    const noteId = req.params.noteId;
    const {title, content, tags, isPinned} = req.body;
    const {user} = req.user;

    if(!title && !content && !tags ) {
        return res.status(400)
        .json({error: true, message: "No changes provided"})
    }

    try {
        const note = await Note.findOne({_id: noteId, userId: user._id});
        if(!note){
            return res.status(404).json({error: true, message: "Note not found"});
        }

        if (title) note.title = title;
        if (content) note.content = content;
        if (tags) note.tags = tags;
        if (isPinned) note.isPinned = isPinned;

        await note.save();

        return res.json({
            error: false,
            note,
            message: "Note updated sucessfully"
        });
    }
    catch (error){
        return res.status(500).json({
            error: true,
            message: "Internal server error"
        });
    }
});

// All notes
app.get("/get-all-notes/", authenticateToken, async (req, res) =>{
    const { user } = req.user;

    try {
        const notes = await Note.find({ userId: user._id}).sort({ isPinned: -1});

        return res.json({
            error: false,
            notes,
            message: "All notes retrieved successfully"
        });
    }
        catch(error){
            return res.status(500)
            .json({
                error: true,
                message: "Internal server error"
            });
    }
});

//delete notes 

app.delete("/delete-notes/:noteId", authenticateToken, async (req, res) => {
    const noteId = req.params.noteId;
    const { user } = req.user;

    try{
        const note = await Note.findOne({_id: noteId, userId: user._id});
        if(!note) {
            return res
            .status(404)
            .json({error: true, message: "Note not found"});
        }
        await Note.deleteOne({_id: noteId, userId: user._id});

        return res.json({
            error: false,
            message: "Note deleted successfully",
        })
    }
        catch(error) {
            return res.status(500)
            .json({
                error: true,
                message: "Internal server error",
            });
        }
});

// isPinned update
app.put("/update-note-pinned/:noteId", authenticateToken, async (req, res) => {
    const noteId = req.params.noteId;
    const {isPinned} = req.body;
    const {user} = req.user;

    try {
        const note = await Note.findOne({_id: noteId, userId: user._id});
        if(!note){
            return res.status(404).json({error: true, message: "Note not found"});
        }

        note.isPinned = isPinned ;

        await note.save();

        return res.json({
            error: false,
            note,
            message: "Note updated sucessfully"
        });
    }
    catch (error){
        return res.status(500).json({
            error: true,
            message: "Internal server error"
        });
    }
});


//Searching 

app.get("/search-notes/", authenticateToken, async (req, res) => {
    const { user } = req.user;
    const { query } = req.query;

   if (!query) {
        return res
            .status(400)
            .json({ error: true, message: "Query is required" });
    }

    try {
        const matchingNotes = await Note.find({
            userId: user._id,
            $or: [
                { title: { $regex: new RegExp(query, "i") } },
                { content: { $regex: new RegExp(query, "i") } },
            ],
        });

        return res.json({
            error: false,
            notes: matchingNotes,
            message: "Notes retrieved successfully",
        });
    } catch (error) {
        console.error(error); 
        return res.status(500).json({
            error: true,
            message: "Internal server error",
        });
    }
});


const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


module.exports = app;


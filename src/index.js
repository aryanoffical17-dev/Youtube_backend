import { app } from "./app.js";
import connectDB from "./db/index.js";

const port = Number(process.env.PORT) || 8000;
try {
    for (const secretName of ["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"]) {
        if (!process.env[secretName]) {
            throw new Error(`${secretName} is required`);
        }
    }
    await connectDB();
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
} catch (error) {
    console.error("Server startup failed:", error);
    process.exitCode = 1;
}

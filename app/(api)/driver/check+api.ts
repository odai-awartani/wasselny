import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      console.error("Missing user_id in request");
      return Response.json({ error: "Missing user_id" }, { status: 400 });
    }

    console.log("Checking driver status for user_id:", user_id);

    // Get user document from Firestore
    const userRef = doc(db, "users", user_id);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      console.log("User document not found for user_id:", user_id);
      return Response.json({ 
        isDriver: false,
        error: "User not found" 
      }, { status: 200 });
    }

    const userData = userDoc.data();
    console.log("User data retrieved:", userData);
    
    // Check if user has driver data
    if (userData?.driver) {
      console.log("Driver data found for user:", userData.driver);
      return Response.json(
        {
          isDriver: true,
          driverId: userData.driver.id,
        },
        { status: 200 }
      );
    }

    console.log("No driver data found for user");
    // If no driver data exists
    return Response.json(
      {
        isDriver: false,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error checking driver in Firestore:", error);
    console.error("Error stack:", error.stack);
    return Response.json(
      { 
        error: "Internal Server Error", 
        details: error.message,
        isDriver: false
      },
      { status: 200 }
    );
  }
}
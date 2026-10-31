import { NextResponse } from "next/server";

/**
 * API endpoint for server time synchronization
 * Returns current Vietnam time for frontend synchronization
 */
export async function GET() {
  try {
    // Get current time in Vietnam timezone
    const now = new Date();
    
    // Create a proper VN time string in ISO format
    const vnTimeString = now.toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }); // sv-SE gives YYYY-MM-DD HH:mm:ss format
    const vnTime = new Date(vnTimeString);
    
    return NextResponse.json({
      vnTime: vnTime.toISOString(),
      vnTimeFormatted: now.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
      vnTimeString: vnTimeString,
      timestamp: Date.now(),
      timezone: "Asia/Ho_Chi_Minh",
      success: true,
    });
  } catch (error) {
    console.error("Error getting current time:", error);
    return NextResponse.json(
      {
        error: "Failed to get current time",
        success: false,
      },
      { status: 500 }
    );
  }
}
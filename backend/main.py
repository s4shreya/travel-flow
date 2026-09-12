"""TravelFlow API entrypoint."""

# Standard library imports
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from core.config import logger
from core.exceptions import AppException, app_exception_handler


# router imports
from src.approvals.router import router as approvals_router
from src.finance.router import router as finance_router
from src.me.router import router as me_router
from src.notifications.router import router as notifications_router
from src.receipts.router import router as receipts_router
from src.settlements.router import router as settlements_router
from src.travel_requests.router import router as travel_requests_router


# Routers list
INCLUDE_ROUTERS = [
    me_router,
    travel_requests_router,
    receipts_router,
    settlements_router,
    approvals_router,
    finance_router,
    notifications_router,
]


# Initialize the FastAPI application
app = FastAPI()


# Include all routers
for router in INCLUDE_ROUTERS:
    app.include_router(router, prefix="/api")


# Add CORS middleware to the FastAPI application
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],  # Allow requests from given origin
    allow_credentials=True,  # Allow cookies and authentication headers in cross-origin requests
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allow all headers in cross-origin requests
)

app.add_exception_handler(AppException, app_exception_handler)


# Exception handler for pydantic validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Get the original 'detail' list of errors
    details = exc.errors()
    logger.info(f"Validation error on {request.url.path}: {details}")

    # Creates the modified details list to store modified errors
    modified_details = []
    for error in details:
        logger.info(f'Error type: {error["type"]} and message is {error["msg"]}')
        modified_details.append(
            {
                "sub_status_code": error["type"],
                "message": error["msg"],
            }
        )
    # Gets the initial error in the modified_details list
    initial_error = modified_details[0] if modified_details else {
        "sub_status_code": "validation_error",
        "message": "Invalid request",
    }

    # Returns JSONResponse with appropriate status code and content
    return JSONResponse(
        status_code=422,
        content={
            "sub_status_code": initial_error["sub_status_code"],
            "message": initial_error["message"],
        },
    )


# Exception handler for general exceptions
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(
        f"status code: 500"
        f"\nUnexpected error occurred, caught in general exception handler in main. Error: {exc}"
    )
    return JSONResponse(
        status_code=500,
        content={
            "sub_status_code": "internal_server_error",
            "message": "Unexpected server error",
            "details": f"Error: {exc}",
        },
    )


# Example GET endpoint
@app.get("/status", tags=["status"])
async def status():
    return {"message": "API is up and running"}

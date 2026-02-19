class HorizonException(Exception):
    """
    Raised for expected application errors (4xx).
    The GlobalErrorHandler catches these and returns a structured JSON response
    without sending a Slack alert.
    """

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)

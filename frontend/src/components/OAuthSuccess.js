import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

function OAuthSuccess({ setIsLoggedIn }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get("token");

    if (token) {
      localStorage.setItem("token", token);
      setIsLoggedIn(true);
      navigate("/");
    }
  }, [params, navigate, setIsLoggedIn]);

  return <h2 style={{ textAlign: "center" }}>Logging you in...</h2>;
}

export default OAuthSuccess;
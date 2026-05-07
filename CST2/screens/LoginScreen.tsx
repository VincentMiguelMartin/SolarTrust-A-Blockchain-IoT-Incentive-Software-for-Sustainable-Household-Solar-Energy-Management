import React, { useContext, useState } from "react";
import { supabase } from "../lib/supabase";

import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet
} from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { AuthContext, UserRole } from "../context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.1.39:3000";
const BASE_URL = API_BASE_URL.replace(/\/+$/, "");

export default function LoginScreen({ navigation }: Props) {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { setRole } = useContext(AuthContext);

  const handleLogin = async () => {

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) {
      alert("This account does not exist or Email/Password is incorrect");
      return;
    }

    if (data.user) {
      console.log("Logged in:", data.user.email);
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        console.log("Unable to load profile role:", profileError.message);
      }

      let storedRole =
        profile?.role ??
        data.user.user_metadata?.role ??
        data.user.app_metadata?.role;

      if (data.session?.access_token) {
        try {
          const roleResponse = await fetch(`${BASE_URL}/auth/role`, {
            headers: {
              Authorization: `Bearer ${data.session.access_token}`,
            },
          });

          if (roleResponse.ok) {
            const roleData = await roleResponse.json();
            storedRole = roleData?.role ?? storedRole;
          } else {
            console.log("Unable to load server role:", roleResponse.status);
          }
        } catch (roleError) {
          console.log("Unable to load server role:", roleError);
        }
      }

      const role: UserRole =
        String(storedRole).trim().toLowerCase() === "admin" ? "admin" : "user";

      setRole(role);
      navigation.replace(role === "admin" ? "AdminDashboard" : "UserDashboard");
    }
  };

  return (
    <SafeAreaView style={styles.container}>

      <Text style={styles.welcome}>Welcome</Text>

      {/* EMAIL */}
      <View style={styles.inputBox}>
        <MaterialIcons name="email" size={24} color="black" />
        <TextInput
          placeholder="Email"
          placeholderTextColor="#555"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      {/* PASSWORD */}
      <View style={styles.inputBox}>
        <MaterialIcons name="lock" size={24} color="black" />

        <TextInput
          placeholder="Password"
          placeholderTextColor="#555"
          secureTextEntry={!showPassword}
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <MaterialIcons
            name={showPassword ? "visibility-off" : "visibility"}
            size={22}
            color="black"
          />
        </TouchableOpacity>
      </View>

      {/* LOGIN BUTTON */}
      <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
        <Text style={styles.loginText}>Login</Text>
      </TouchableOpacity>

      {/* CREATE ACCOUNT */}
      <TouchableOpacity onPress={() => navigation.navigate("Register")}>
        <Text style={styles.createAccount}>CREATE ACCOUNT</Text>
      </TouchableOpacity>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ebeaea",
    paddingHorizontal: 25,
    paddingTop: 60
  },

  welcome: {
    color: "#32702f",
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 30
  },

  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#d9d9d9",
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 55,
    marginBottom: 15
  },

  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: "#000"
  },

  loginBtn: {
    backgroundColor: "#32702f",
    height: 55,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 15
  },

  loginText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF"
  },

  createAccount: {
    color: "#000",
    textAlign: "center",
    marginTop: 25,
    fontWeight: "bold",
    letterSpacing: 1
  }
});

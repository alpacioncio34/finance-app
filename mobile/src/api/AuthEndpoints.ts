import { post, put } from './helpers/ApiRequestsHelper'

function login (data) {
  return post('auth/login', data)
}

function register (data) {
  return post('auth/register', data)
}

function me (data) {
  return get('auth/me', data)
}

export { login, register, me }